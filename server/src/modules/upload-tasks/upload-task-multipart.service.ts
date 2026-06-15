import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  FileKind,
  Prisma,
  UploadMultipartStatus,
  UploadTaskStage,
  UploadTaskStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { OssCompatibleService } from '../uploads/oss-compatible.service';
import { OssService } from '../uploads/oss.service';
import {
  ALLOWED_EXTENSIONS,
  extractExtension,
  isMimeAllowed,
  normalizeMime,
} from '../uploads/upload.constants';
import type {
  MultipartPartDescriptor,
  ObjectStorageService,
} from '../uploads/object-storage.interface';
import {
  CompleteUploadTaskMultipartPartDto,
} from './dto/complete-upload-task-multipart-part.dto';
import {
  InitUploadTaskMultipartDto,
  type UploadMultipartKind,
} from './dto/init-upload-task-multipart.dto';
import { PresignUploadTaskMultipartPartsDto } from './dto/presign-upload-task-multipart-parts.dto';
import { VerifyUploadTaskMultipartFileDto } from './dto/verify-upload-task-multipart-file.dto';
import {
  type UploadMultipartAbortVm,
  type UploadMultipartCompleteVm,
  type UploadMultipartInitVm,
  type UploadMultipartPartCompleteVm,
  type UploadMultipartPresignPartsVm,
  type UploadMultipartSessionVm,
  type UploadMultipartVerifyFileVm,
  toUploadMultipartSessionVm,
} from './upload-task-multipart.vm';

const MULTIPART_THRESHOLD_MB = 64;
const MULTIPART_MIN_PART_BYTES = 8 * 1024 * 1024;
const MULTIPART_DEFAULT_PART_BYTES = 32 * 1024 * 1024;
const MULTIPART_MAX_PARTS = 9500;

@Injectable()
export class UploadTaskMultipartService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly ossCompatible: OssCompatibleService,
    private readonly oss: OssService,
  ) {}

  private get storageDriver(): 'oss-compatible' | 'oss' {
    return (this.config.get<'oss-compatible' | 'oss'>('storage.driver') ?? 'oss') as
      | 'oss-compatible'
      | 'oss';
  }

  private get storage(): ObjectStorageService {
    const endpoint = String(this.config.get<string>('oss.endpoint') ?? '').toLowerCase();
    if (this.storageDriver === 'oss-compatible' || endpoint.includes('s3.oss-')) {
      return this.ossCompatible;
    }
    return this.oss;
  }

  async init(
    userId: bigint,
    taskId: bigint,
    dto: InitUploadTaskMultipartDto,
  ): Promise<UploadMultipartInitVm> {
    const task = await this.findOwnedTaskOrThrow(userId, taskId);
    this.assertTaskCanStartMultipart(task.status);
    const kind = dto.kind;
    const fileKind = this.toFileKind(kind);
    this.assertExtension(fileKind, dto.fileName);
    this.assertSize(fileKind, dto.size, dto.fileName);

    const existing = await this.prisma.uploadMultipartSession.findFirst({
      where: {
        uploadTaskId: task.id,
        kind: fileKind,
        isCurrent: true,
      },
      include: {
        parts: true,
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    if (existing) {
      return toUploadMultipartSessionVm(existing);
    }

    const objectKey = this.storage.buildKey(fileKind, userId, dto.fileName);
    const fileSize = dto.size;
    const partSize = this.computePartSize(fileSize);
    const totalParts = Math.ceil(fileSize / partSize);
    if (totalParts < 1 || totalParts > MULTIPART_MAX_PARTS) {
      throw new BadRequestException(
        `分片数量非法，totalParts=${totalParts}，最大允许 ${MULTIPART_MAX_PARTS}`,
      );
    }

    const multipart = await this.storage.initiateMultipartUpload(objectKey, dto.mime);
    const now = new Date();
    const parts = Array.from({ length: totalParts }, (_, index) => {
      const partNumber = index + 1;
      const byteStart = index * partSize;
      const byteEnd = Math.min(fileSize, (index + 1) * partSize);
      return {
        partNumber,
        byteStart: BigInt(byteStart),
        byteEnd: BigInt(byteEnd),
        partSize: BigInt(byteEnd - byteStart),
      };
    });

    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const session = await tx.uploadMultipartSession.create({
          data: {
            uploadTaskId: task.id,
            userId,
            kind: fileKind,
            objectKey,
            ossUploadId: multipart.uploadId,
            originalName: dto.fileName,
            mime: dto.mime,
            fileSize: BigInt(fileSize),
            partSize: BigInt(partSize),
            totalParts,
            fingerprintAlgo: dto.fingerprintAlgo?.trim() || null,
            fingerprint: dto.fingerprint?.trim() || null,
            fileLastModified:
              dto.lastModified == null ? null : BigInt(dto.lastModified),
            status: UploadMultipartStatus.initiated,
            lastActivityAt: now,
            initiatedAt: now,
            isCurrent: true,
          },
        });

        await tx.uploadMultipartPart.createMany({
          data: parts.map((part) => ({
            sessionId: session.id,
            partNumber: part.partNumber,
            byteStart: part.byteStart,
            byteEnd: part.byteEnd,
            partSize: part.partSize,
          })),
        });

        await tx.uploadTask.update({
          where: { id: task.id },
          data: this.buildTaskProgressPatch(kind, objectKey),
        });

        return tx.uploadMultipartSession.findUniqueOrThrow({
          where: { id: session.id },
          include: { parts: true },
        });
      });
      return toUploadMultipartSessionVm(created);
    } catch (error) {
      await this.tryAbortMultipart(objectKey, multipart.uploadId);
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const existed = await this.prisma.uploadMultipartSession.findFirst({
          where: {
            uploadTaskId: task.id,
            kind: fileKind,
            isCurrent: true,
          },
          include: { parts: true },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        });
        if (existed) return toUploadMultipartSessionVm(existed);
      }
      throw error;
    }
  }

  async getCurrentSession(
    userId: bigint,
    taskId: bigint,
    kind: UploadMultipartKind,
  ): Promise<UploadMultipartSessionVm> {
    const task = await this.findOwnedTaskOrThrow(userId, taskId);
    const session = await this.findCurrentSessionOrThrow(userId, taskId, kind);
    return toUploadMultipartSessionVm(
      session,
      this.canResumeTaskMultipart(task, session, kind),
    );
  }

  async verifyFile(
    userId: bigint,
    taskId: bigint,
    kind: UploadMultipartKind,
    dto: VerifyUploadTaskMultipartFileDto,
  ): Promise<UploadMultipartVerifyFileVm> {
    const task = await this.findOwnedTaskOrThrow(userId, taskId);
    const session = await this.findCurrentSessionOrThrow(userId, taskId, kind);
    const canResume = this.canResumeTaskMultipart(task, session, kind);
    const sessionVm = toUploadMultipartSessionVm(session, canResume);

    if (!canResume) {
      return {
        matched: false,
        reason: 'fingerprint_mismatch',
        canResume: false,
        session: sessionVm,
      };
    }

    if (dto.fileName.trim() !== session.originalName.trim()) {
      return {
        matched: false,
        reason: 'name_mismatch',
        canResume,
        session: sessionVm,
      };
    }

    if (dto.fileSize !== Number(session.fileSize)) {
      return {
        matched: false,
        reason: 'size_mismatch',
        canResume,
        session: sessionVm,
      };
    }

    if (
      session.fileLastModified != null &&
      dto.fileLastModified !== Number(session.fileLastModified)
    ) {
      return {
        matched: false,
        reason: 'fingerprint_mismatch',
        canResume,
        session: sessionVm,
      };
    }

    if (session.fingerprintAlgo && dto.fingerprintAlgo !== session.fingerprintAlgo) {
      return {
        matched: false,
        reason: 'fingerprint_mismatch',
        canResume,
        session: sessionVm,
      };
    }

    if (session.fingerprint && dto.fingerprint !== session.fingerprint) {
      return {
        matched: false,
        reason: 'fingerprint_mismatch',
        canResume,
        session: sessionVm,
      };
    }

    return {
      matched: true,
      canResume,
      session: sessionVm,
    };
  }

  async presignParts(
    userId: bigint,
    taskId: bigint,
    kind: UploadMultipartKind,
    dto: PresignUploadTaskMultipartPartsDto,
  ): Promise<UploadMultipartPresignPartsVm> {
    const session = await this.findCurrentSessionOrThrow(userId, taskId, kind);
    this.assertSessionOperable(session.status);
    const uniquePartNumbers = [...new Set(dto.partNumbers)].sort((a, b) => a - b);
    this.assertPartNumbersInRange(uniquePartNumbers, session.totalParts);

    await this.prisma.uploadMultipartSession.update({
      where: { id: session.id },
      data: {
        status: UploadMultipartStatus.uploading,
        lastActivityAt: new Date(),
      },
    });

    const parts = await Promise.all(
      uniquePartNumbers.map(async (partNumber) => ({
        partNumber,
        uploadUrl: await this.storage.presignUploadPart(
          session.objectKey,
          session.ossUploadId,
          partNumber,
        ),
        expiresIn: this.storage.presignExpires,
        method: 'PUT' as const,
        headers: {},
      })),
    );

    return {
      sessionId: Number(session.id),
      objectKey: session.objectKey,
      uploadId: session.ossUploadId,
      parts,
    };
  }

  async completePart(
    userId: bigint,
    taskId: bigint,
    kind: UploadMultipartKind,
    partNumber: number,
    dto: CompleteUploadTaskMultipartPartDto,
  ): Promise<UploadMultipartPartCompleteVm> {
    const session = await this.findCurrentSessionOrThrow(userId, taskId, kind);
    this.assertSessionOperable(session.status);
    this.assertPartNumbersInRange([partNumber], session.totalParts);

    const part = await this.prisma.uploadMultipartPart.findUnique({
      where: {
        sessionId_partNumber: {
          sessionId: session.id,
          partNumber,
        },
      },
    });
    if (!part) {
      throw new NotFoundException('multipart 分片不存在');
    }
    if (Number(part.partSize) !== dto.partSize) {
      throw new BadRequestException('partSize 与服务端分片规划不一致');
    }

    const etag = this.normalizeEtag(dto.etag);
    const now = new Date();

    await this.prisma.uploadMultipartPart.update({
      where: { id: part.id },
      data: {
        etag,
        uploadedAt: now,
        attemptCount: { increment: 1 },
        lastErrorCode: null,
        lastErrorMessage: null,
      },
    });

    const progress = await this.recalculateSessionProgress(session.id);
    await this.prisma.$transaction([
      this.prisma.uploadMultipartSession.update({
        where: { id: session.id },
        data: {
          status: UploadMultipartStatus.uploading,
          uploadedBytes: BigInt(progress.uploadedBytes),
          completedPartsCount: progress.completedPartsCount,
          lastActivityAt: now,
          lastErrorCode: null,
          lastErrorMessage: null,
        },
      }),
      this.prisma.uploadTask.update({
        where: { id: session.uploadTaskId },
        data: this.buildTaskProgressPatch(kind, session.objectKey),
      }),
    ]);

    return {
      sessionId: Number(session.id),
      partNumber,
      etag,
      uploadedBytes: progress.uploadedBytes,
      completedPartsCount: progress.completedPartsCount,
      status: UploadMultipartStatus.uploading,
    };
  }

  async complete(
    userId: bigint,
    taskId: bigint,
    kind: UploadMultipartKind,
  ): Promise<UploadMultipartCompleteVm> {
    const session = await this.findCurrentSessionOrThrow(userId, taskId, kind, true);
    if (
      session.status === UploadMultipartStatus.completed &&
      session.modelFileId != null &&
      session.modelFile
    ) {
      return {
        sessionId: Number(session.id),
        fileId: Number(session.modelFile.id),
        objectKey: session.objectKey,
        url: session.modelFile.url,
        kind: session.kind,
      };
    }
    this.assertSessionCompletable(session);

    const parts = [...(session.parts ?? [])]
      .sort((a, b) => a.partNumber - b.partNumber)
      .map<MultipartPartDescriptor>((part) => ({
        partNumber: part.partNumber,
        etag: this.normalizeEtag(part.etag ?? ''),
      }));

    try {
      await this.storage.completeMultipartUpload(
        session.objectKey,
        session.ossUploadId,
        parts,
      );
    } catch (error) {
      await this.prisma.uploadMultipartSession.update({
        where: { id: session.id },
        data: {
          status: UploadMultipartStatus.failed,
          lastErrorCode: 'complete_failed',
          lastErrorMessage:
            error instanceof Error ? error.message : 'multipart complete 失败',
          lastActivityAt: new Date(),
        },
      });
      throw error;
    }

    const head = await this.storage.headObject(session.objectKey);
    if (head.size !== Number(session.fileSize)) {
      throw new BadRequestException('对象存储中的文件大小与 multipart 会话不一致');
    }
    this.assertHeadMime(session.kind, head.mime);

    const url = this.storage.publicUrl(session.objectKey);
    const now = new Date();
    const file = await this.prisma.$transaction(async (tx) => {
      const createdFile = await tx.modelFile.create({
        data: {
          userId,
          kind: session.kind,
          originalName: session.originalName,
          r2Key: session.objectKey,
          url,
          size: BigInt(head.size),
          mime: normalizeMime(head.mime),
        },
      });

      await tx.uploadMultipartSession.update({
        where: { id: session.id },
        data: {
          status: UploadMultipartStatus.completed,
          uploadedBytes: session.fileSize,
          completedPartsCount: session.totalParts,
          modelFileId: createdFile.id,
          completedAt: now,
          lastActivityAt: now,
          lastErrorCode: null,
          lastErrorMessage: null,
        },
      });

      await tx.uploadTask.update({
        where: { id: session.uploadTaskId },
        data:
          session.kind === FileKind.model
            ? {
                modelFileId: createdFile.id,
                currentModelObjectKey: session.objectKey,
                status: UploadTaskStatus.running,
                stage: UploadTaskStage.callbacking_model,
                lastErrorCode: null,
                lastErrorMessage: null,
              }
            : {
                coverFileId: createdFile.id,
                currentCoverObjectKey: session.objectKey,
                status: UploadTaskStatus.running,
                stage: UploadTaskStage.callbacking_cover,
                lastErrorCode: null,
                lastErrorMessage: null,
              },
      });

      return createdFile;
    });

    return {
      sessionId: Number(session.id),
      fileId: Number(file.id),
      objectKey: session.objectKey,
      url,
      kind: session.kind,
    };
  }

  async abort(
    userId: bigint,
    taskId: bigint,
    kind: UploadMultipartKind,
  ): Promise<UploadMultipartAbortVm> {
    const session = await this.findCurrentSessionOrThrow(userId, taskId, kind);
    if (session.status === UploadMultipartStatus.completed) {
      throw new BadRequestException('已完成的 multipart 会话不能 abort');
    }
    if (session.status === UploadMultipartStatus.aborted) {
      return {
        sessionId: Number(session.id),
        status: session.status,
        abortedAt: session.abortedAt ?? null,
      };
    }

    await this.storage.abortMultipartUpload(session.objectKey, session.ossUploadId);
    const now = new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.uploadMultipartSession.update({
        where: { id: session.id },
        data: {
          status: UploadMultipartStatus.aborted,
          abortedAt: now,
          isCurrent: false,
          lastActivityAt: now,
          lastErrorCode: null,
          lastErrorMessage: null,
        },
      });

      await tx.uploadTask.update({
        where: { id: session.uploadTaskId },
        data: {
          status: UploadTaskStatus.canceled,
          stage: UploadTaskStage.canceled,
          canceledAt: now,
        },
      });

      return next;
    });

    return {
      sessionId: Number(updated.id),
      status: updated.status,
      abortedAt: updated.abortedAt ?? null,
    };
  }

  private async findOwnedTaskOrThrow(userId: bigint, taskId: bigint) {
    const task = await this.prisma.uploadTask.findFirst({
      where: {
        id: taskId,
        userId,
      },
      select: {
        id: true,
        userId: true,
        status: true,
        modelId: true,
      },
    });
    if (!task) {
      throw new NotFoundException('上传任务不存在');
    }
    return task;
  }

  private canResumeTaskMultipart(
    task: { status: UploadTaskStatus; modelId: bigint | null },
    session: { status: UploadMultipartStatus },
    kind: UploadMultipartKind,
  ): boolean {
    if (kind !== 'model') return false;
    if (task.modelId != null) return false;
    if (task.status === UploadTaskStatus.canceled) return false;
    if (
      task.status !== UploadTaskStatus.interrupted &&
      task.status !== UploadTaskStatus.failed &&
      task.status !== UploadTaskStatus.running
    ) {
      return false;
    }
    return session.status !== UploadMultipartStatus.aborted;
  }

  private async findCurrentSessionOrThrow(
    userId: bigint,
    taskId: bigint,
    kind: UploadMultipartKind,
    withParts = false,
  ) {
    await this.findOwnedTaskOrThrow(userId, taskId);
    const session = await this.prisma.uploadMultipartSession.findFirst({
      where: {
        uploadTaskId: taskId,
        userId,
        kind: this.toFileKind(kind),
        isCurrent: true,
      },
      include: {
        parts: true,
        modelFile: withParts,
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    if (!session) {
      throw new NotFoundException('multipart 会话不存在');
    }
    return session;
  }

  private toFileKind(kind: UploadMultipartKind): FileKind {
    return kind === 'model' ? FileKind.model : FileKind.cover;
  }

  private assertTaskCanStartMultipart(status: UploadTaskStatus): void {
    if (
      status === UploadTaskStatus.published ||
      status === UploadTaskStatus.canceled
    ) {
      throw new BadRequestException('当前任务状态不允许初始化 multipart');
    }
  }

  private assertSessionOperable(status: UploadMultipartStatus): void {
    if (status === UploadMultipartStatus.completed) {
      throw new BadRequestException('当前 multipart 会话已完成');
    }
    if (status === UploadMultipartStatus.aborted) {
      throw new BadRequestException('当前 multipart 会话已中止');
    }
  }

  private assertSessionCompletable(session: {
    status: UploadMultipartStatus;
    totalParts: number;
    parts?: Array<{ etag: string | null }>;
  }): void {
    if (session.status === UploadMultipartStatus.aborted) {
      throw new BadRequestException('已中止的 multipart 会话不能 complete');
    }
    const uploadedParts = (session.parts ?? []).filter((part) => part.etag != null);
    if (uploadedParts.length !== session.totalParts) {
      throw new BadRequestException('仍有缺失分片，不能完成 multipart 上传');
    }
  }

  private assertPartNumbersInRange(
    partNumbers: number[],
    totalParts: number,
  ): void {
    for (const partNumber of partNumbers) {
      if (partNumber < 1 || partNumber > totalParts) {
        throw new BadRequestException(
          `partNumber=${partNumber} 超出范围，合法区间为 1..${totalParts}`,
        );
      }
    }
  }

  private computePartSize(fileSize: number): number {
    const computed = Math.ceil(fileSize / MULTIPART_MAX_PARTS);
    const partSize = Math.max(MULTIPART_MIN_PART_BYTES, computed);
    return Math.max(partSize, Math.min(fileSize, MULTIPART_DEFAULT_PART_BYTES));
  }

  private buildTaskProgressPatch(kind: UploadMultipartKind, objectKey: string) {
    const now = new Date();
    return kind === 'model'
      ? {
          status: UploadTaskStatus.running,
          stage: UploadTaskStage.uploading_model,
          currentModelObjectKey: objectKey,
          startedAt: now,
          lastHeartbeatAt: now,
          interruptedAt: null,
          canceledAt: null,
          lastErrorCode: null,
          lastErrorMessage: null,
        }
      : {
          status: UploadTaskStatus.running,
          stage: UploadTaskStage.uploading_cover,
          currentCoverObjectKey: objectKey,
          startedAt: now,
          lastHeartbeatAt: now,
          interruptedAt: null,
          canceledAt: null,
          lastErrorCode: null,
          lastErrorMessage: null,
        };
  }

  private assertExtension(kind: FileKind, fileName: string): void {
    const ext = extractExtension(fileName);
    const allowed = ALLOWED_EXTENSIONS[kind];
    if (!ext || !allowed.includes(ext)) {
      throw new BadRequestException(
        `不支持的文件类型：.${ext || '(无扩展名)'}；${kind} 允许：${allowed.join('/')}`,
      );
    }
  }

  private assertHeadMime(kind: FileKind, mime: string): void {
    if (!isMimeAllowed(kind, mime)) {
      throw new BadRequestException(
        `对象存储中的文件类型不允许：${normalizeMime(mime) || '(空)'}；请检查上传文件格式`,
      );
    }
  }

  private assertSize(kind: FileKind, size: number, fileName?: string): void {
    const maxModel = this.config.get<number>('upload.maxModelBytes') ?? 0;
    const maxCover = this.config.get<number>('upload.maxCoverBytes') ?? 0;
    const zipModelLimit = 1024 * 1024 * 1024;
    const extension = fileName ? extractExtension(fileName) : '';
    const limit =
      kind === FileKind.cover
        ? maxCover
        : extension === 'zip'
          ? Math.max(maxModel, zipModelLimit)
          : maxModel;
    if (limit > 0 && size > limit) {
      const limitMb = Math.round(limit / 1024 / 1024);
      throw new BadRequestException(`文件超过大小上限（${limitMb}MB）`);
    }
  }

  private normalizeEtag(etag: string): string {
    const value = etag.trim();
    if (!value) {
      throw new BadRequestException('etag 不能为空');
    }
    if (value.startsWith('"') && value.endsWith('"')) {
      return value;
    }
    return `"${value.replace(/^"+|"+$/g, '')}"`;
  }

  private async recalculateSessionProgress(sessionId: bigint): Promise<{
    uploadedBytes: number;
    completedPartsCount: number;
  }> {
    const result = await this.prisma.uploadMultipartPart.aggregate({
      where: {
        sessionId,
        etag: { not: null },
      },
      _sum: {
        partSize: true,
      },
      _count: {
        _all: true,
      },
    });

    return {
      uploadedBytes: Number(result._sum.partSize ?? 0n),
      completedPartsCount: result._count._all,
    };
  }

  private async tryAbortMultipart(
    objectKey: string,
    uploadId: string,
  ): Promise<void> {
    try {
      await this.storage.abortMultipartUpload(objectKey, uploadId);
    } catch {
      // 初始化落库失败时仅做 best-effort 清理，避免覆盖原始错误。
    }
  }
}
