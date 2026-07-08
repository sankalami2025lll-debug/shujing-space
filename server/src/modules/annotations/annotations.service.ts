/**
 * 服务：AnnotationsService
 * 用途：模型空间热点标注的 CRUD + 媒体绑定。
 * 权限口径：
 *  - 读（list）：复用 ModelsService.findOne 可见性——游客/非作者仅 public+published；作者可看自己全状态模型。
 *    作者视角返回 active+hidden 标注；其余仅 active。
 *  - 写（create/update/delete + media）：必须登录且为模型 owner；非 owner → 403；模型不存在/无权限 → 404。
 * 媒体口径：
 *  - V1 媒体图片复用 /uploads/presign+callback（kind=cover）链路，前端拿到 fileId 后调用 media 接口。
 *  - media 接口按 fileId 反查 model_files，校验归属当前用户 + kind=cover，取出 objectKey/url 落 model_annotation_media。
 *  - 不允许本地文件落盘；objectKey/url 来自 OSS（model_files.url / model_files.r2_key）。
 */
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { AnnotationStatus, FileKind, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ModelsService } from '../models/models.service';
import { parseAnnotationCameraSnapshot } from '../models/launch-view.contract';
import { CreateAnnotationDto } from './dto/create-annotation.dto';
import { UpdateAnnotationDto } from './dto/update-annotation.dto';
import { CreateAnnotationMediaDto } from './dto/create-annotation-media.dto';
import {
  toAnnotationMediaVm,
  toAnnotationVm,
  type ModelAnnotationVm,
} from './annotations.vm';

@Injectable()
export class AnnotationsService {
  private readonly logger = new Logger(AnnotationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly modelsService: ModelsService,
  ) {}

  /**
   * 列出模型下的标注。
   * - 先通过 ModelsService.findOne 校验模型可见性（不可见 → 404，与详情接口一致）。
   * - 作者视角返回 active+hidden；其余仅 active。
   * - 按 sortOrder、id 升序，附带 media（按 sortOrder 升序）。
   */
  async list(modelId: bigint, userId?: bigint): Promise<ModelAnnotationVm[]> {
    const detail = await this.modelsService.findOne(modelId, userId);
    const isOwner =
      userId !== undefined && detail.userId === Number(userId);

    const where: Prisma.ModelAnnotationWhereInput = {
      modelId,
      ...(isOwner ? {} : { status: AnnotationStatus.active }),
    };

    const rows = await this.prisma.modelAnnotation.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      include: {
        media: { orderBy: { sortOrder: 'asc' } },
      },
    });

    return rows.map(toAnnotationVm);
  }

  /**
   * 新增标注（仅 owner）。
   * cameraSnapshot 复用 ModelLaunchView 校验，非法 → 400。
   */
  async create(
    modelId: bigint,
    userId: bigint,
    dto: CreateAnnotationDto,
  ): Promise<ModelAnnotationVm> {
    await this.assertOwner(modelId, userId);
    const cameraSnapshot = this.parseCameraSnapshotOrThrow(dto.cameraSnapshot);

    const created = await this.prisma.modelAnnotation.create({
      data: {
        modelId,
        ownerId: userId,
        title: dto.title.trim(),
        description: dto.description?.trim() ?? '',
        anchorPosition: dto.anchorPosition as unknown as Prisma.InputJsonValue,
        anchorNormal:
          dto.anchorNormal != null
            ? (dto.anchorNormal as unknown as Prisma.InputJsonValue)
            : Prisma.JsonNull,
        cameraSnapshot:
          cameraSnapshot as unknown as Prisma.InputJsonValue,
        displayOffset:
          dto.displayOffset != null
            ? (dto.displayOffset as unknown as Prisma.InputJsonValue)
            : Prisma.JsonNull,
        status: dto.status ?? AnnotationStatus.active,
        sortOrder: dto.sortOrder ?? 0,
      },
      include: { media: { orderBy: { sortOrder: 'asc' } } },
    });

    return toAnnotationVm(created);
  }

  /**
   * 更新标注（仅 owner）。所有字段可选；cameraSnapshot 若提供则复用校验。
   */
  async update(
    modelId: bigint,
    annotationId: bigint,
    userId: bigint,
    dto: UpdateAnnotationDto,
  ): Promise<ModelAnnotationVm> {
    await this.assertOwner(modelId, userId);
    const existing = await this.findAnnotationOfModel(modelId, annotationId);

    const data: Prisma.ModelAnnotationUpdateInput = {};

    if (dto.title !== undefined) {
      const trimmed = dto.title.trim();
      if (trimmed.length === 0) {
        throw new BadRequestException('title 不能为空');
      }
      data.title = trimmed;
    }
    if (dto.description !== undefined) {
      data.description = dto.description.trim();
    }
    if (dto.anchorPosition !== undefined) {
      data.anchorPosition =
        dto.anchorPosition as unknown as Prisma.InputJsonValue;
    }
    if (dto.anchorNormal !== undefined) {
      data.anchorNormal =
        dto.anchorNormal as unknown as Prisma.InputJsonValue;
    }
    if (dto.cameraSnapshot !== undefined) {
      data.cameraSnapshot =
        this.parseCameraSnapshotOrThrow(
          dto.cameraSnapshot,
        ) as unknown as Prisma.InputJsonValue;
    }
    if (dto.displayOffset !== undefined) {
      data.displayOffset =
        dto.displayOffset as unknown as Prisma.InputJsonValue;
    }
    if (dto.status !== undefined) {
      data.status = dto.status;
    }
    if (dto.sortOrder !== undefined) {
      data.sortOrder = dto.sortOrder;
    }

    if (Object.keys(data).length === 0) {
      throw new BadRequestException('至少要更新一个字段');
    }

    const updated = await this.prisma.modelAnnotation.update({
      where: { id: existing.id },
      data,
      include: { media: { orderBy: { sortOrder: 'asc' } } },
    });

    return toAnnotationVm(updated);
  }

  /**
   * 删除标注（仅 owner）。级联删除媒体记录（onDelete: Cascade）。
   */
  async remove(
    modelId: bigint,
    annotationId: bigint,
    userId: bigint,
  ): Promise<{ id: number; deleted: true }> {
    await this.assertOwner(modelId, userId);
    const existing = await this.findAnnotationOfModel(modelId, annotationId);
    await this.prisma.modelAnnotation.delete({ where: { id: existing.id } });
    return { id: Number(existing.id), deleted: true };
  }

  // V1.1 标注图片：每个标注最多 3 张 image；允许的 MIME（与 cover 直传链路一致，去掉非标准 image/jpg）
  private static readonly ANNOTATION_MAX_IMAGES = 3;
  private static readonly ANNOTATION_IMAGE_MIMES = new Set([
    'image/jpeg',
    'image/png',
    'image/webp',
  ]);

  /**
   * 为标注新增媒体（仅 owner）。
   * V1.1 仅完整支持 image：mediaType 必须为 image（panorama/video 为类型预留，不开放写入）。
   * fileId 反查 model_files，校验归属当前用户 + kind=cover（复用封面图直传链路，对象只存 OSS）。
   * 额外校验：每个标注最多 3 张 image；cover 文件 MIME 必须为 image/jpeg|png|webp；
   * sortOrder 缺省按「当前 image 数量」回填，保证按上传顺序排列。
   */
  async addMedia(
    modelId: bigint,
    annotationId: bigint,
    userId: bigint,
    dto: CreateAnnotationMediaDto,
  ): Promise<ModelAnnotationVm> {
    await this.assertOwner(modelId, userId);
    const annotation = await this.findAnnotationOfModel(modelId, annotationId);

    if (dto.mediaType !== 'image') {
      throw new BadRequestException('V1 暂仅支持图片媒体');
    }

    // 3 张上限：统计该标注已有的 image 媒体数
    const existingImageCount = await this.prisma.modelAnnotationMedia.count({
      where: { annotationId: annotation.id, mediaType: 'image' },
    });
    if (existingImageCount >= AnnotationsService.ANNOTATION_MAX_IMAGES) {
      throw new BadRequestException(
        `每个标注最多 ${AnnotationsService.ANNOTATION_MAX_IMAGES} 张图片`,
      );
    }

    const file = await this.prisma.modelFile.findFirst({
      where: { id: BigInt(dto.fileId), userId, kind: FileKind.cover },
    });
    if (!file) {
      throw new BadRequestException(
        '媒体文件不存在或无权限（必须为本人上传的图片）',
      );
    }

    // 二次校验对象存储文件 MIME（cover 链路已限制扩展名，这里按 MIME 收紧到 jpeg/png/webp）
    const fileMime = (file.mime ?? '').split(';')[0]?.trim().toLowerCase() ?? '';
    if (!AnnotationsService.ANNOTATION_IMAGE_MIMES.has(fileMime)) {
      throw new BadRequestException(
        '标注图片仅支持 jpg / png / webp',
      );
    }

    await this.prisma.modelAnnotationMedia.create({
      data: {
        annotationId: annotation.id,
        mediaType: dto.mediaType,
        url: file.url,
        objectKey: file.r2Key,
        fileName: dto.fileName ?? file.originalName,
        mimeType: fileMime,
        size: file.size,
        // 缺省按上传顺序排列：已有一张则新图 sortOrder=1，以此类推（0~2）
        sortOrder: dto.sortOrder ?? existingImageCount,
      },
    });

    const refreshed = await this.prisma.modelAnnotation.findUnique({
      where: { id: annotation.id },
      include: { media: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!refreshed) {
      throw new NotFoundException('标注不存在');
    }
    return toAnnotationVm(refreshed);
  }

  /**
   * 删除标注媒体（仅 owner）。
   */
  async removeMedia(
    modelId: bigint,
    annotationId: bigint,
    mediaId: bigint,
    userId: bigint,
  ): Promise<ModelAnnotationVm> {
    await this.assertOwner(modelId, userId);
    const annotation = await this.findAnnotationOfModel(modelId, annotationId);

    const media = await this.prisma.modelAnnotationMedia.findFirst({
      where: { id: mediaId, annotationId: annotation.id },
    });
    if (!media) {
      throw new NotFoundException('媒体不存在');
    }

    await this.prisma.modelAnnotationMedia.delete({ where: { id: media.id } });

    const refreshed = await this.prisma.modelAnnotation.findUnique({
      where: { id: annotation.id },
      include: { media: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!refreshed) {
      throw new NotFoundException('标注不存在');
    }
    return toAnnotationVm(refreshed);
  }

  // —— 内部校验 ——

  /**
   * 校验当前用户为模型 owner。
   * 模型不存在或已删除 → 404；非 owner → 403。
   */
  private async assertOwner(modelId: bigint, userId: bigint): Promise<void> {
    const model = await this.prisma.model.findUnique({
      where: { id: modelId },
      select: { id: true, userId: true, deletedAt: true },
    });
    if (!model || model.deletedAt) {
      throw new NotFoundException('模型不存在');
    }
    if (model.userId !== userId) {
      throw new ForbiddenException('仅模型归属用户可以管理标注');
    }
  }

  /**
   * 取得指定标注并校验其属于该模型；不存在 → 404。
   */
  private async findAnnotationOfModel(modelId: bigint, annotationId: bigint) {
    const annotation = await this.prisma.modelAnnotation.findFirst({
      where: { id: annotationId, modelId },
      select: { id: true },
    });
    if (!annotation) {
      throw new NotFoundException('标注不存在');
    }
    return annotation;
  }

  private parseCameraSnapshotOrThrow(value: unknown) {
    const parsed = parseAnnotationCameraSnapshot(value);
    if (!parsed) {
      throw new BadRequestException('cameraSnapshot 格式非法');
    }
    return parsed;
  }
}
