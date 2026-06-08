/**
 * 服务：ModelsService
 * 用途：模型列表与详情的只读查询（本阶段不实现新增/编辑/删除/审核/上传）。
 * 安全口径：
 *  - 列表（findList）仅 status=published 且 visibility=public 且 deletedAt=null。
 *  - 详情（findOne）：游客与非作者同上；作者可查看本人未删除模型的任意状态/可见性模型。
 *  - 不存在或无权限统一 404，避免泄露非公开模型是否存在。
 * 红线：BigInt 主键统一在 VM 层转 number；本层只出业务真值。
 */
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  FileKind,
  ModelProcessingStatus,
  ModelStatus,
  ModelVisibility,
  Prisma,
  ViewerType,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { extractExtension } from '../uploads/upload.constants';
import { CreateModelDto } from './dto/create-model.dto';
import { UpdateLaunchViewDto } from './dto/update-launch-view.dto';
import { isViewerUrlAllowed } from './viewer-url.util';
import { ModelSortValue, QueryModelsDto } from './dto/query-models.dto';
import { ModelLaunchView, parseModelLaunchView } from './launch-view.contract';
import {
  ModelDetailVm,
  ModelInteractionFlags,
  ModelListItemVm,
  toModelDetailVm,
  toModelListItemVm,
} from './model.vm';
import { LccZipService } from './lcc-zip.service';

// 列表接口返回结构（分页）
export interface ModelListResult {
  list: ModelListItemVm[];
  total: number;
  page: number;
  pageSize: number;
}

@Injectable()
export class ModelsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly lccZipService: LccZipService,
  ) {}

  // 游客可见性的统一过滤条件：已发布 + 公开 + 解析完成 + 未软删除
  private readonly publicWhere: Prisma.ModelWhereInput = {
    status: ModelStatus.published,
    visibility: ModelVisibility.public,
    processingStatus: ModelProcessingStatus.ready,
    deletedAt: null,
  };

  /**
   * 模型列表（GET /api/models）。
   * 支持 type 分类过滤、keyword（标题 + 作者昵称）检索、sort 排序、分页。
   * userId 可选：登录态时为当前用户 id，用于批量附带 isLiked / isFavorited（游客不附带）。
   */
  async findList(query: QueryModelsDto, userId?: bigint): Promise<ModelListResult> {
    const { type, keyword, sort, page, pageSize } = query;

    // 组装查询条件：先并入公开过滤
    const where: Prisma.ModelWhereInput = { ...this.publicWhere };

    // 分类过滤：空或「全部模型」不过滤
    if (type && type !== '全部模型') {
      where.type = type;
    }

    // 关键词：匹配标题（不区分大小写）或作者昵称（不区分大小写）
    if (keyword && keyword.trim()) {
      const kw = keyword.trim();
      where.OR = [
        { title: { contains: kw, mode: 'insensitive' } },
        { user: { is: { nickname: { contains: kw, mode: 'insensitive' } } } },
      ];
    }

    const orderBy = this.resolveOrderBy(sort);
    const skip = (page - 1) * pageSize;

    // 并行查询总数与当前页数据
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.model.count({ where }),
      this.prisma.model.findMany({
        where,
        orderBy,
        skip,
        take: pageSize,
        include: {
          user: { select: { nickname: true } }, // author ← user.nickname
        },
      }),
    ]);

    // 登录态：批量查询当前页模型的点赞/收藏状态（避免逐条 N+1）
    const interactionMap = await this.buildInteractionMap(
      userId,
      rows.map((r) => r.id),
    );

    return {
      list: rows.map((r) =>
        toModelListItemVm(r, interactionMap?.get(r.id.toString())),
      ),
      total,
      page,
      pageSize,
    };
  }

  /**
   * 批量构建「当前用户对一批模型的点赞/收藏状态」映射（避免 N+1）。
   * - 游客（userId 为空）或空列表：返回 null，调用方不附带 isLiked/isFavorited。
   * - 登录态：一次性查出该用户在这批 modelId 上的 likes / favorites，构造 Set 后映射。
   * 说明：key 用 modelId.toString()，规避 BigInt 作为 Map 键的比较歧义。
   */
  private async buildInteractionMap(
    userId: bigint | undefined,
    modelIds: bigint[],
  ): Promise<Map<string, ModelInteractionFlags> | null> {
    if (!userId || modelIds.length === 0) {
      return null;
    }

    const [likes, favorites] = await this.prisma.$transaction([
      this.prisma.like.findMany({
        where: { userId, modelId: { in: modelIds } },
        select: { modelId: true },
      }),
      this.prisma.favorite.findMany({
        where: { userId, modelId: { in: modelIds } },
        select: { modelId: true },
      }),
    ]);

    const likedSet = new Set(likes.map((l) => l.modelId.toString()));
    const favoritedSet = new Set(favorites.map((f) => f.modelId.toString()));

    const map = new Map<string, ModelInteractionFlags>();
    for (const id of modelIds) {
      const key = id.toString();
      map.set(key, {
        isLiked: likedSet.has(key),
        isFavorited: favoritedSet.has(key),
      });
    }
    return map;
  }

  /**
   * 模型详情（GET /api/models/:id，2F 作者可见性）。
   * - 游客 / 非作者：仅 status=published 且 visibility=public 且 deletedAt=null。
   * - 作者本人：可查看自己未删除的 draft / pending / rejected / private / published 等全状态模型。
   * - 已删除模型统一 404；本阶段不做回收站。
   * - 未找到或无权限：404「模型不存在或暂未公开」（不区分原因，避免泄露）。
   * userId 可选：登录态时附带 isLiked / isFavorited；作者本人额外附带 status / visibility / rejectReason。
   */
  async findOne(id: bigint, userId?: bigint): Promise<ModelDetailVm> {
    // 登录态：公开模型 OR 本人未删除模型；游客：仅公开且未删除模型
    const where: Prisma.ModelWhereInput = userId
      ? { id, OR: [this.publicWhere, { userId, deletedAt: null }] }
      : { id, ...this.publicWhere };

    const model = await this.prisma.model.findFirst({
      where,
      include: {
        user: { select: { nickname: true } }, // author ← user.nickname
        category: { select: { id: true, name: true, slug: true } }, // 关联分类
      },
    });
    if (!model) {
      throw new NotFoundException('模型不存在或暂未公开');
    }

    // 作者本人视角：附带 status / visibility / rejectReason（2F）
    const isAuthor = userId !== undefined && model.userId === userId;

    // 登录态：附带当前用户对该模型的点赞/收藏状态（复用批量逻辑，单条同样安全）
    const interactionMap = await this.buildInteractionMap(userId, [model.id]);
    return toModelDetailVm(
      model,
      interactionMap?.get(model.id.toString()),
      isAuthor,
    );
  }

  /**
   * 保存模型启动视图（PUT /api/models/:id/launch-view，需登录且仅作者本人可调用）。
   * - 模型不存在 / 已删除：404
   * - 非模型归属用户：403
   * - launchView 格式非法：400
   */
  async saveLaunchView(
    userId: bigint,
    modelId: bigint,
    payload: UpdateLaunchViewDto,
  ): Promise<{
    launchView: ModelLaunchView;
    updatedAt: Date;
    updatedBy: number;
  }> {
    const model = await this.findLaunchViewOwnedModel(modelId);
    if (model.userId !== userId) {
      throw new ForbiddenException('仅模型归属用户可以保存启动视图');
    }

    const launchView = this.parseLaunchViewOrThrow(payload);
    const updatedAt = new Date();
    await this.prisma.model.update({
      where: { id: modelId },
      data: {
        launchViewJson: launchView as unknown as Prisma.InputJsonValue,
        launchViewUpdatedAt: updatedAt,
        launchViewUpdatedBy: userId,
      },
    });

    return {
      launchView,
      updatedAt,
      updatedBy: Number(userId),
    };
  }

  /**
   * 清空模型启动视图（DELETE /api/models/:id/launch-view，需登录且仅作者本人可调用）。
   * - 模型不存在 / 已删除：404
   * - 非模型归属用户：403
   */
  async clearLaunchView(
    userId: bigint,
    modelId: bigint,
  ): Promise<{ launchView: null; cleared: true }> {
    const model = await this.findLaunchViewOwnedModel(modelId);
    if (model.userId !== userId) {
      throw new ForbiddenException('仅模型归属用户可以清空启动视图');
    }

    await this.prisma.model.update({
      where: { id: modelId },
      data: {
        launchViewJson: Prisma.JsonNull,
        launchViewUpdatedAt: null,
        launchViewUpdatedBy: null,
      },
    });

    return {
      launchView: null,
      cleared: true,
    };
  }

  /**
   * 发布模型（POST /api/models，需登录）。
   * 关联已上传到对象存储的模型/封面文件（按 fileId 反查 model_files，校验归属），
   * 反查得 modelUrl / coverUrl 落库；status 由 visibility 推导。
   * 第一版无独立审核流：public→published（直接公开）、review→pending（待审核）、private→published（仅本人可见）。
   */
  async create(userId: bigint, dto: CreateModelDto): Promise<ModelDetailVm> {
    // 1. 分类：按名称反查 categoryId（未匹配则 categoryId 为空，仍保留 type 文案）
    const category = await this.prisma.category.findUnique({
      where: { name: dto.type },
    });

    // 2. 模型文件：按 fileId 反查并校验归属与用途
    let modelUrl: string | null = null;
    let fileFormat: string | null = null;
    let modelFile:
      | Awaited<ReturnType<ModelsService['findOwnedFile']>>
      | null = null;
    if (dto.modelFileId != null) {
      modelFile = await this.findOwnedFile(userId, dto.modelFileId, FileKind.model);
      modelUrl = modelFile.url;
      fileFormat = extractExtension(modelFile.originalName) || null;
    } else if (dto.viewerUrl) {
      // 无上传文件但提供外部 Viewer 链接：先校验域名白名单（2D），通过后作为 modelUrl
      this.assertViewerUrlAllowed(dto.viewerUrl);
      modelUrl = dto.viewerUrl;
    }

    // 3. 封面文件：按 fileId 反查并校验归属与用途
    let coverUrl = '';
    if (dto.coverFileId != null) {
      const coverFile = await this.findOwnedFile(userId, dto.coverFileId, FileKind.cover);
      coverUrl = coverFile.url;
    }

    // 4. 查看器类型：优先用入参；否则上传文件→native、外链→iframe、都无→none
    const viewerType: ViewerType =
      dto.viewerType ??
      (dto.modelFileId != null
        ? ViewerType.native
        : dto.viewerUrl
          ? ViewerType.iframe
          : ViewerType.none);

    // 5. 状态：由可见性推导（review 进待审核，其余直接发布）
    const status =
      dto.visibility === ModelVisibility.review
        ? ModelStatus.pending
        : ModelStatus.published;
    const processingStatus =
      dto.modelFileId != null
        ? ModelProcessingStatus.processing
        : ModelProcessingStatus.ready;
    const processedAt =
      processingStatus === ModelProcessingStatus.ready ? new Date() : null;

    // 6. 创建模型记录
    const created = await this.prisma.model.create({
      data: {
        userId,
        categoryId: category ? category.id : null,
        type: dto.type,
        title: dto.title,
        tags: [], // 发布表单暂不收集 tags，留空数组
        scenes: dto.scenes ?? [],
        description: dto.description ?? '',
        coverUrl,
        modelUrl,
        viewerType,
        allowIframe: dto.allowIframe ?? true,
        fileFormat,
        visibility: dto.visibility,
        status,
        processingStatus,
        processingError: null,
        processedAt,
      },
      include: {
        user: { select: { nickname: true } },
        category: { select: { id: true, name: true, slug: true } },
      },
    });

    if (modelFile && this.shouldProcessAsLccZip(fileFormat)) {
      try {
        const processed = await this.lccZipService.processUploadedZip(
          created.id,
          this.getStoredObjectKey(modelFile),
        );
        await this.markReady(created.id, {
          viewerUrl: processed.entryUrl,
          modelUrl: processed.entryUrl,
          fileFormat: processed.fileFormat,
          viewerType: ViewerType.native,
        });
      } catch (error) {
        const reason =
          error instanceof Error && error.message.trim()
            ? error.message.trim()
            : 'LCC/LCC2 ZIP 成果包处理失败';
        await this.markFailed(created.id, reason);
      }

      const updated = await this.prisma.model.findUnique({
        where: { id: created.id },
        include: {
          user: { select: { nickname: true } },
          category: { select: { id: true, name: true, slug: true } },
        },
      });
      if (!updated) {
        throw new NotFoundException('模型不存在');
      }
      return toModelDetailVm(updated, undefined, true);
    }

    return toModelDetailVm(created, undefined, true);
  }

  /**
   * 记录浏览量（POST /api/models/:id/view，2E）。
   * 仅对「已发布 + 公开」模型 viewsCount +1，与读接口可见性口径一致；不存在/不可见 → 404。
   * 本阶段最小可用：不做防刷 / 去重（每次调用都 +1），返回最新 viewsCount。
   */
  async recordView(id: bigint): Promise<{ viewsCount: number }> {
    // 先校验目标模型存在且对外可见，避免对私有/草稿/审核中模型打点
    const model = await this.prisma.model.findFirst({
      where: { id, ...this.publicWhere },
      select: { id: true },
    });
    if (!model) {
      throw new NotFoundException('模型不存在或暂未公开');
    }
    const updated = await this.prisma.model.update({
      where: { id },
      data: { viewsCount: { increment: 1 } },
      select: { viewsCount: true },
    });
    return { viewsCount: updated.viewsCount };
  }

  // 预留：解析任务开始后把模型标记为 processing。
  async markProcessing(modelId: bigint): Promise<void> {
    await this.prisma.model.update({
      where: { id: modelId },
      data: {
        processingStatus: ModelProcessingStatus.processing,
        processingError: null,
        processedAt: null,
      },
    });
  }

  // 预留：解析完成后把模型标记为 ready，并允许顺带回写可浏览地址。
  async markReady(
    modelId: bigint,
    payload?: {
      viewerUrl?: string | null;
      modelUrl?: string | null;
      fileFormat?: string | null;
      viewerType?: ViewerType;
    },
  ): Promise<void> {
    const nextUrl = payload?.viewerUrl ?? payload?.modelUrl;
    await this.prisma.model.update({
      where: { id: modelId },
      data: {
        processingStatus: ModelProcessingStatus.ready,
        processingError: null,
        processedAt: new Date(),
        ...(nextUrl ? { modelUrl: nextUrl } : {}),
        ...(payload?.fileFormat ? { fileFormat: payload.fileFormat } : {}),
        ...(payload?.viewerType ? { viewerType: payload.viewerType } : {}),
      },
    });
    await this.syncUploadTaskAfterModelReady(modelId);
  }

  // 预留：解析失败后记录失败原因，后续可由后台或引擎重试。
  async markFailed(modelId: bigint, reason: string): Promise<void> {
    await this.prisma.model.update({
      where: { id: modelId },
      data: {
        processingStatus: ModelProcessingStatus.failed,
        processingError: reason.trim() || '解析失败',
        processedAt: null,
      },
    });
    await this.syncUploadTaskAfterModelFailed(modelId, reason);
  }

  // 校验外链 viewerUrl：必须 https 且 hostname 命中白名单（上线前安全修复 2D）。
  // 白名单来自配置 viewer.allowedHosts（env VIEWER_URL_ALLOWED_HOSTS，缺省回退默认安全列表）。
  // 仅作用于外链发布分支，不影响 modelFileId/coverFileId 的对象存储发布路径与历史数据读取。
  private assertViewerUrlAllowed(viewerUrl: string): void {
    const viewer = this.config.get<{ allowedHosts: string[] }>('viewer');
    const allowedHosts = viewer?.allowedHosts ?? [];
    if (!isViewerUrlAllowed(viewerUrl, allowedHosts)) {
      throw new BadRequestException('viewerUrl 域名不在允许列表中');
    }
  }

  // 按 fileId 反查 model_files，并校验归属当前用户 + 用途匹配；不符抛 400
  private async findOwnedFile(userId: bigint, fileId: number, kind: FileKind) {
    const file = await this.prisma.modelFile.findFirst({
      where: { id: BigInt(fileId), userId, kind },
    });
    if (!file) {
      throw new BadRequestException(
        `文件不存在或无权限（fileId=${fileId}, kind=${kind}）`,
      );
    }
    return file;
  }

  private shouldProcessAsLccZip(fileFormat: string | null): boolean {
    // 当前缺少单独的「LCC ZIP」显式字段，第一版先按 .zip 上传统一进入成果包处理流程。
    // 这能打通主链路，但仍有误处理普通 ZIP 的风险，文档中需明确记录。
    return fileFormat === 'zip';
  }

  // 当前数据库字段仍为 r2_key；待未来 schema 迁移后再统一删除该兼容读取。
  private getStoredObjectKey(file: { objectKey?: string; r2Key?: string }): string {
    return file.objectKey ?? file.r2Key ?? '';
  }

  // sort 参数 → Prisma orderBy 映射
  private resolveOrderBy(sort: ModelSortValue): Prisma.ModelOrderByWithRelationInput {
    switch (sort) {
      case 'views':
        return { viewsCount: 'desc' };
      case 'favorites':
        return { favoritesCount: 'desc' };
      case 'latest':
      case 'recommended':
      default:
        // recommended 暂无独立推荐算法，先与 latest 一致按创建时间倒序兜底
        return { createdAt: 'desc' };
    }
  }

  private parseLaunchViewOrThrow(payload: unknown): ModelLaunchView {
    const launchView = parseModelLaunchView(payload);
    if (!launchView) {
      throw new BadRequestException('launchView 格式非法');
    }
    return launchView;
  }

  private async syncUploadTaskAfterModelReady(modelId: bigint): Promise<void> {
    await this.prisma.uploadTask.updateMany({
      where: { modelId },
      data: {
        status: 'published',
        stage: 'published',
        publishedAt: new Date(),
        lastErrorStage: null,
        lastErrorCode: null,
        lastErrorMessage: null,
      },
    });
  }

  private async syncUploadTaskAfterModelFailed(
    modelId: bigint,
    reason: string,
  ): Promise<void> {
    await this.prisma.uploadTask.updateMany({
      where: { modelId },
      data: {
        status: 'failed',
        stage: 'failed',
        lastErrorStage: 'processing',
        lastErrorCode: null,
        lastErrorMessage: reason.trim() || '解析失败',
      },
    });
  }

  private async findLaunchViewOwnedModel(modelId: bigint) {
    const model = await this.prisma.model.findUnique({
      where: { id: modelId },
      select: {
        id: true,
        userId: true,
        deletedAt: true,
      },
    });

    if (!model || model.deletedAt) {
      throw new NotFoundException('模型不存在');
    }

    return model;
  }
}
