/**
 * 服务：UsersService
 * 用途：个人中心各 Tab 的只读查询（开发顺序第 7 步·第二阶段）。
 * 红线：
 *  - 所有查询严格按当前 userId 过滤，禁止越权读他人数据。
 *  - BigInt 主键 / 计数统一在 VM 层或本层转 number。
 *  - 本阶段只读：不实现编辑资料 / 删除模型 / 审核 / 训练申请提交。
 */
import { Injectable } from '@nestjs/common';
import { ModelStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { MyModelStatusFilter, QueryMyModelsDto } from './dto/query-my-models.dto';
import {
  MeStatsVm,
  MyApplicationVm,
  MyFavoriteVm,
  MyModelVm,
  toMyApplicationVm,
  toMyFavoriteVm,
  toMyModelVm,
} from './users.vm';

// 通用分页返回结构
export interface PaginatedResult<T> {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 我的模型（GET /api/users/me/models）。
   * 本人视角：返回本人全部状态模型，可按 status 过滤（all 不过滤）。
   */
  async findMyModels(
    userId: bigint,
    query: QueryMyModelsDto,
  ): Promise<PaginatedResult<MyModelVm>> {
    return this.queryModels(userId, query.status, query.page, query.pageSize);
  }

  /**
   * 我的发布（GET /api/users/me/published）。
   * 等价于本人 status=published 的模型。
   */
  async findMyPublished(
    userId: bigint,
    pagination: PaginationDto,
  ): Promise<PaginatedResult<MyModelVm>> {
    return this.queryModels(userId, 'published', pagination.page, pagination.pageSize);
  }

  /**
   * 我的收藏（GET /api/users/me/favorites）。
   * 按收藏时间倒序；附带 isFavorited(恒 true) / isAvailable(是否仍 published+public) / favoritedAt。
   */
  async findMyFavorites(
    userId: bigint,
    pagination: PaginationDto,
  ): Promise<PaginatedResult<MyFavoriteVm>> {
    const { page, pageSize } = pagination;
    const skip = (page - 1) * pageSize;

    const where: Prisma.FavoriteWhereInput = { userId };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.favorite.count({ where }),
      this.prisma.favorite.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        include: {
          // 关联模型 + 作者昵称（用于卡片展示）
          model: { include: { user: { select: { nickname: true } } } },
        },
      }),
    ]);

    return { list: rows.map(toMyFavoriteVm), total, page, pageSize };
  }

  /**
   * 我的训练数据服务申请（GET /api/users/me/applications）。
   * 按创建时间倒序；无数据时返回空数组（total=0）。
   */
  async findMyApplications(
    userId: bigint,
    pagination: PaginationDto,
  ): Promise<PaginatedResult<MyApplicationVm>> {
    const { page, pageSize } = pagination;
    const skip = (page - 1) * pageSize;

    const where: Prisma.TrainingApplicationWhereInput = { userId };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.trainingApplication.count({ where }),
      this.prisma.trainingApplication.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
    ]);

    return { list: rows.map(toMyApplicationVm), total, page, pageSize };
  }

  /**
   * 个人中心统计角标（GET /api/users/me/stats）。
   * 一次事务并行 count，口径与各列表 where 保持一致。
   */
  async getStats(userId: bigint): Promise<MeStatsVm> {
    const [models, published, pending, rejected, favorites, applications] =
      await this.prisma.$transaction([
        this.prisma.model.count({ where: { userId } }),
        this.prisma.model.count({ where: { userId, status: ModelStatus.published } }),
        this.prisma.model.count({ where: { userId, status: ModelStatus.pending } }),
        this.prisma.model.count({ where: { userId, status: ModelStatus.rejected } }),
        this.prisma.favorite.count({ where: { userId } }),
        this.prisma.trainingApplication.count({ where: { userId } }),
      ]);

    return { models, published, pending, rejected, favorites, applications };
  }

  // —— 内部工具 ——

  // 我的模型通用查询：按 userId + 可选状态过滤，创建时间倒序分页
  private async queryModels(
    userId: bigint,
    status: MyModelStatusFilter,
    page: number,
    pageSize: number,
  ): Promise<PaginatedResult<MyModelVm>> {
    const skip = (page - 1) * pageSize;

    // 严格按当前用户过滤；status=all 时不附加状态条件
    const where: Prisma.ModelWhereInput = { userId };
    if (status !== 'all') {
      where.status = status as ModelStatus;
    }

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.model.count({ where }),
      this.prisma.model.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
    ]);

    return { list: rows.map(toMyModelVm), total, page, pageSize };
  }
}
