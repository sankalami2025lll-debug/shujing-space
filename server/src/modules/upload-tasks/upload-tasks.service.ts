/**
 * 服务：UploadTasksService
 * 用途：上传任务持久化编排；不替代 uploads/models 主链路，只负责任务状态、文件绑定与发布收口。
 */
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  FileKind,
  ModelProcessingStatus,
  Prisma,
  UploadTaskStage,
  UploadTaskStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ModelsService } from '../models/models.service';
import { CreateUploadTaskDto } from './dto/create-upload-task.dto';
import { BindUploadTaskFileDto } from './dto/bind-upload-task-file.dto';
import { QueryMyUploadTasksDto } from './dto/query-my-upload-tasks.dto';
import { UpdateUploadTaskStatusDto } from './dto/update-upload-task-status.dto';
import {
  type UploadTaskPublishVm,
  type UploadTaskVm,
  toUploadTaskVm,
} from './upload-task.vm';

const TASK_CARD_VISIBLE_STATUSES: UploadTaskStatus[] = [
  UploadTaskStatus.queued,
  UploadTaskStatus.running,
  UploadTaskStatus.processing,
  UploadTaskStatus.failed,
  UploadTaskStatus.canceled,
  UploadTaskStatus.interrupted,
];

const TERMINAL_STATUSES = new Set<UploadTaskStatus>([
  UploadTaskStatus.published,
  UploadTaskStatus.failed,
  UploadTaskStatus.canceled,
  UploadTaskStatus.interrupted,
]);

const STALE_TASK_TIMEOUT_MS = 2 * 60 * 1000;
const INTERRUPTED_MESSAGE = '上传已中断，可重新上传。';

@Injectable()
export class UploadTasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly modelsService: ModelsService,
  ) {}

  async createTask(
    userId: bigint,
    dto: CreateUploadTaskDto,
  ): Promise<UploadTaskVm> {
    const clientToken = dto.clientToken?.trim() || null;
    const viewerUrl = dto.viewerUrl?.trim() || null;
    const plannedModelName = dto.plannedModelName?.trim() || null;

    if (!viewerUrl && !plannedModelName) {
      throw new BadRequestException('请至少提供 plannedModelName 或 viewerUrl');
    }

    if (clientToken) {
      const existed = await this.prisma.uploadTask.findUnique({
        where: {
          userId_clientToken: {
            userId,
            clientToken,
          },
        },
        include: {
          coverFile: { select: { url: true } },
        },
      });
      if (existed) return toUploadTaskVm(existed);
    }

    try {
      const created = await this.prisma.uploadTask.create({
        data: {
          userId,
          clientToken,
          title: dto.title.trim(),
          type: dto.type.trim(),
          scenesJson: (dto.scenes ?? []) as Prisma.InputJsonValue,
          description: dto.description?.trim() ?? '',
          visibility: dto.visibility,
          viewerUrl,
          plannedModelName,
          plannedModelSize:
            dto.plannedModelSize == null ? null : BigInt(dto.plannedModelSize),
          plannedModelMime: dto.plannedModelMime?.trim() || null,
          plannedCoverName: dto.plannedCoverName?.trim() || null,
          plannedCoverSize:
            dto.plannedCoverSize == null ? null : BigInt(dto.plannedCoverSize),
          plannedCoverMime: dto.plannedCoverMime?.trim() || null,
        },
        include: {
          coverFile: { select: { url: true } },
        },
      });
      return toUploadTaskVm(created);
    } catch (error) {
      if (
        clientToken &&
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const existed = await this.prisma.uploadTask.findUnique({
          where: {
            userId_clientToken: {
              userId,
              clientToken,
            },
          },
          include: {
            coverFile: { select: { url: true } },
          },
        });
        if (existed) return toUploadTaskVm(existed);
      }
      throw error;
    }
  }

  async getMyTasks(
    userId: bigint,
    query: QueryMyUploadTasksDto,
  ): Promise<UploadTaskVm[]> {
    await this.normalizeStaleTasks(userId);

    const tasks = await this.prisma.uploadTask.findMany({
      where: {
        userId,
        ...(query.status === 'incomplete'
          ? { status: { in: TASK_CARD_VISIBLE_STATUSES } }
          : {}),
      },
      include: {
        coverFile: { select: { url: true } },
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    });

    return tasks.map(toUploadTaskVm);
  }

  async updateTaskStatus(
    userId: bigint,
    taskId: bigint,
    dto: UpdateUploadTaskStatusDto,
  ): Promise<UploadTaskVm> {
    const task = await this.findOwnedTaskOrThrow(userId, taskId);

    if (dto.status === UploadTaskStatus.published || dto.stage === UploadTaskStage.published) {
      throw new BadRequestException('不允许客户端直接写入 published 状态');
    }

    if (dto.status === UploadTaskStatus.processing && !task.modelId) {
      throw new BadRequestException('任务尚未绑定 modelId，不能写入 processing 状态');
    }

    const nextStatus = dto.status ?? task.status;
    const nextStage = dto.stage ?? task.stage;
    const now = new Date();
    const becomesRunning =
      nextStatus === UploadTaskStatus.running &&
      task.status !== UploadTaskStatus.running;

    const updated = await this.prisma.uploadTask.update({
      where: { id: task.id },
      data: {
        status: nextStatus,
        stage: nextStage,
        currentModelObjectKey:
          dto.currentModelObjectKey?.trim() || task.currentModelObjectKey,
        currentCoverObjectKey:
          dto.currentCoverObjectKey?.trim() || task.currentCoverObjectKey,
        lastErrorStage:
          dto.lastErrorStage == null
            ? nextStatus === UploadTaskStatus.failed
              ? nextStage
              : task.lastErrorStage
            : dto.lastErrorStage,
        lastErrorCode:
          dto.lastErrorCode === undefined
            ? becomesRunning
              ? null
              : task.lastErrorCode
            : dto.lastErrorCode?.trim() || null,
        lastErrorMessage:
          dto.lastErrorMessage === undefined
            ? becomesRunning
              ? null
              : task.lastErrorMessage
            : dto.lastErrorMessage?.trim() || null,
        attemptCount: becomesRunning ? { increment: 1 } : undefined,
        startedAt:
          becomesRunning && task.startedAt == null ? now : undefined,
        interruptedAt:
          nextStatus === UploadTaskStatus.interrupted
            ? now
            : becomesRunning
              ? null
              : undefined,
        canceledAt:
          nextStatus === UploadTaskStatus.canceled
            ? now
            : becomesRunning
              ? null
              : undefined,
      },
      include: {
        coverFile: { select: { url: true } },
      },
    });

    return toUploadTaskVm(updated);
  }

  async heartbeat(userId: bigint, taskId: bigint): Promise<UploadTaskVm> {
    const task = await this.findOwnedTaskOrThrow(userId, taskId);
    if (
      task.status !== UploadTaskStatus.queued &&
      task.status !== UploadTaskStatus.running
    ) {
      throw new BadRequestException('只有 queued/running 任务允许更新 heartbeat');
    }

    const updated = await this.prisma.uploadTask.update({
      where: { id: task.id },
      data: {
        lastHeartbeatAt: new Date(),
      },
      include: {
        coverFile: { select: { url: true } },
      },
    });
    return toUploadTaskVm(updated);
  }

  async bindFile(
    userId: bigint,
    taskId: bigint,
    dto: BindUploadTaskFileDto,
  ): Promise<UploadTaskVm> {
    const task = await this.findOwnedTaskOrThrow(userId, taskId);
    if (task.modelId) {
      throw new BadRequestException('任务已生成正式模型，不能再绑定文件');
    }

    const kind = dto.kind === 'model' ? FileKind.model : FileKind.cover;
    const file = await this.prisma.modelFile.findFirst({
      where: {
        id: BigInt(dto.fileId),
        userId,
        kind,
      },
      select: {
        id: true,
        kind: true,
        r2Key: true,
      },
    });
    if (!file) {
      throw new BadRequestException('文件不存在或不属于当前用户');
    }

    const isModel = dto.kind === 'model';
    const currentBoundId = isModel ? task.modelFileId : task.coverFileId;
    if (currentBoundId === file.id) {
      const existed = await this.prisma.uploadTask.findUniqueOrThrow({
        where: { id: task.id },
        include: { coverFile: { select: { url: true } } },
      });
      return toUploadTaskVm(existed);
    }

    const updated = await this.prisma.uploadTask.update({
      where: { id: task.id },
      data: isModel
        ? {
            modelFileId: file.id,
            currentModelObjectKey: file.r2Key,
          }
        : {
            coverFileId: file.id,
            currentCoverObjectKey: file.r2Key,
          },
      include: {
        coverFile: { select: { url: true } },
      },
    });
    return toUploadTaskVm(updated);
  }

  async publish(userId: bigint, taskId: bigint): Promise<UploadTaskPublishVm> {
    const task = await this.findOwnedTaskOrThrow(userId, taskId);

    if (task.modelId) {
      const model = await this.modelsService.findOne(task.modelId, userId);
      const current = await this.prisma.uploadTask.findUniqueOrThrow({
        where: { id: task.id },
        include: {
          coverFile: { select: { url: true } },
        },
      });
      return { task: toUploadTaskVm(current), model };
    }

    if (task.status === UploadTaskStatus.canceled) {
      throw new BadRequestException('已取消任务不能直接发布');
    }
    if (!task.modelFileId && !task.viewerUrl) {
      throw new BadRequestException('请先绑定模型文件或填写 viewerUrl');
    }

    await this.prisma.uploadTask.update({
      where: { id: task.id },
      data: {
        status: UploadTaskStatus.running,
        stage: UploadTaskStage.creating_model,
        startedAt: task.startedAt ?? new Date(),
      },
    });

    const model = await this.modelsService.create(userId, {
      title: task.title,
      type: task.type,
      scenes: this.parseStringArray(task.scenesJson),
      description: task.description || undefined,
      visibility: task.visibility,
      modelFileId: task.modelFileId == null ? undefined : Number(task.modelFileId),
      coverFileId: task.coverFileId == null ? undefined : Number(task.coverFileId),
      ...(!task.modelFileId && task.viewerUrl
        ? {
            viewerUrl: task.viewerUrl,
            viewerType: 'iframe' as const,
            allowIframe: true,
          }
        : {}),
    });

    const nextStatus =
      model.processingStatus === ModelProcessingStatus.ready
        ? UploadTaskStatus.published
        : model.processingStatus === ModelProcessingStatus.failed
          ? UploadTaskStatus.failed
          : UploadTaskStatus.processing;
    const nextStage =
      nextStatus === UploadTaskStatus.published
        ? UploadTaskStage.published
        : nextStatus === UploadTaskStatus.failed
          ? UploadTaskStage.failed
          : UploadTaskStage.processing;

    const updated = await this.prisma.uploadTask.update({
      where: { id: task.id },
      data: {
        modelId: BigInt(model.id),
        status: nextStatus,
        stage: nextStage,
        publishedAt:
          nextStatus === UploadTaskStatus.published ? new Date() : null,
        lastErrorStage:
          nextStatus === UploadTaskStatus.failed
            ? UploadTaskStage.processing
            : null,
        lastErrorCode: null,
        lastErrorMessage:
          nextStatus === UploadTaskStatus.failed
            ? model.processingError ?? '模型处理失败'
            : null,
      },
      include: {
        coverFile: { select: { url: true } },
      },
    });

    return {
      task: toUploadTaskVm(updated),
      model,
    };
  }

  async cancel(userId: bigint, taskId: bigint): Promise<UploadTaskVm> {
    const task = await this.findOwnedTaskOrThrow(userId, taskId);
    if (task.modelId) {
      throw new BadRequestException('已有 modelId 的任务不允许取消');
    }
    if (task.status === UploadTaskStatus.canceled) {
      const existed = await this.prisma.uploadTask.findUniqueOrThrow({
        where: { id: task.id },
        include: {
          coverFile: { select: { url: true } },
        },
      });
      return toUploadTaskVm(existed);
    }

    const updated = await this.prisma.uploadTask.update({
      where: { id: task.id },
      data: {
        status: UploadTaskStatus.canceled,
        stage: UploadTaskStage.canceled,
        canceledAt: new Date(),
      },
      include: {
        coverFile: { select: { url: true } },
      },
    });
    return toUploadTaskVm(updated);
  }

  async markInterrupted(userId: bigint, taskId: bigint): Promise<UploadTaskVm> {
    const task = await this.findOwnedTaskOrThrow(userId, taskId);
    if (TERMINAL_STATUSES.has(task.status) || task.modelId) {
      const existed = await this.prisma.uploadTask.findUniqueOrThrow({
        where: { id: task.id },
        include: {
          coverFile: { select: { url: true } },
        },
      });
      return toUploadTaskVm(existed);
    }

    const updated = await this.prisma.uploadTask.update({
      where: { id: task.id },
      data: {
        status: UploadTaskStatus.interrupted,
        stage: UploadTaskStage.interrupted,
        interruptedAt: new Date(),
        lastErrorStage: task.stage,
        lastErrorCode: null,
        lastErrorMessage: task.lastErrorMessage ?? INTERRUPTED_MESSAGE,
      },
      include: {
        coverFile: { select: { url: true } },
      },
    });
    return toUploadTaskVm(updated);
  }

  private async normalizeStaleTasks(userId: bigint): Promise<void> {
    const now = new Date();
    const staleBefore = new Date(now.getTime() - STALE_TASK_TIMEOUT_MS);

    await this.prisma.uploadTask.updateMany({
      where: {
        userId,
        modelId: null,
        status: { in: [UploadTaskStatus.queued, UploadTaskStatus.running] },
        lastHeartbeatAt: { lt: staleBefore },
      },
      data: {
        status: UploadTaskStatus.interrupted,
        stage: UploadTaskStage.interrupted,
        interruptedAt: now,
        lastErrorStage: UploadTaskStage.interrupted,
        lastErrorCode: null,
        lastErrorMessage: INTERRUPTED_MESSAGE,
      },
    });

    await this.prisma.uploadTask.updateMany({
      where: {
        userId,
        modelId: null,
        status: { in: [UploadTaskStatus.queued, UploadTaskStatus.running] },
        lastHeartbeatAt: null,
        updatedAt: { lt: staleBefore },
      },
      data: {
        status: UploadTaskStatus.interrupted,
        stage: UploadTaskStage.interrupted,
        interruptedAt: now,
        lastErrorStage: UploadTaskStage.interrupted,
        lastErrorCode: null,
        lastErrorMessage: INTERRUPTED_MESSAGE,
      },
    });
  }

  private async findOwnedTaskOrThrow(userId: bigint, taskId: bigint) {
    const task = await this.prisma.uploadTask.findFirst({
      where: {
        id: taskId,
        userId,
      },
      include: {
        coverFile: { select: { url: true } },
      },
    });
    if (!task) {
      throw new NotFoundException('上传任务不存在');
    }
    return task;
  }

  private parseStringArray(value: Prisma.JsonValue | null): string[] {
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is string => typeof item === 'string');
  }
}
