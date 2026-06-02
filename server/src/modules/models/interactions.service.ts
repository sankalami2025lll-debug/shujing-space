/**
 * 服务：InteractionsService
 * 用途：模型「点赞 / 收藏」的写入与取消（开发顺序第 7 步·互动）。
 * 数据：写 likes / favorites 明细表（含 (userId, modelId) 唯一约束），
 *       同步维护 models.likesCount / favoritesCount 冗余计数。
 * 约束（按本步要求）：
 *  - 必须用事务保证「明细表」与「计数字段」一致；
 *  - 重复点赞/收藏要幂等（已存在则不重复加、不报错）；
 *  - 取消点赞/收藏不能让计数变成负数（仅当存在明细才减，并做 >=0 兜底）。
 * 可见性：仅允许对「已发布 + 公开」的模型操作（与读接口口径一致），否则 404。
 */
import { Injectable, NotFoundException } from '@nestjs/common';
import { ModelStatus, ModelVisibility, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

// 点赞操作返回结构（供前端直接刷新角标）
export interface LikeResult {
  liked: boolean;
  likesCount: number;
}

// 收藏操作返回结构
export interface FavoriteResult {
  favorited: boolean;
  favoritesCount: number;
}

@Injectable()
export class InteractionsService {
  constructor(private readonly prisma: PrismaService) {}

  // 与模型读接口一致的可见性口径：已发布 + 公开
  private readonly visibleWhere = {
    status: ModelStatus.published,
    visibility: ModelVisibility.public,
  };

  /**
   * 点赞（POST /api/models/:id/like）。
   * 幂等：已点赞则保持原状、返回当前计数；事务内「插明细 + 计数 +1」。
   */
  async like(userId: bigint, modelId: bigint): Promise<LikeResult> {
    await this.ensureVisibleModel(modelId);

    const likesCount = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.like.findUnique({
        where: { userId_modelId: { userId, modelId } },
        select: { id: true },
      });
      // 已点赞：幂等，不重复加，直接读回当前计数
      if (existing) {
        return this.readLikesCount(tx, modelId);
      }
      await tx.like.create({ data: { userId, modelId } });
      const updated = await tx.model.update({
        where: { id: modelId },
        data: { likesCount: { increment: 1 } },
        select: { likesCount: true },
      });
      return updated.likesCount;
    });

    return { liked: true, likesCount };
  }

  /**
   * 取消点赞（DELETE /api/models/:id/like）。
   * 幂等：未点赞则保持原状；仅当存在明细才「删明细 + 计数 -1」，并兜底不为负。
   */
  async unlike(userId: bigint, modelId: bigint): Promise<LikeResult> {
    await this.ensureVisibleModel(modelId);

    const likesCount = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.like.findUnique({
        where: { userId_modelId: { userId, modelId } },
        select: { id: true },
      });
      // 未点赞：幂等，直接读回当前计数（不做减法，避免计数变负）
      if (!existing) {
        return this.readLikesCount(tx, modelId);
      }
      await tx.like.delete({ where: { id: existing.id } });
      const updated = await tx.model.update({
        where: { id: modelId },
        data: { likesCount: { decrement: 1 } },
        select: { likesCount: true },
      });
      // 极端兜底：若历史脏数据导致减后为负，纠正为 0
      if (updated.likesCount < 0) {
        const fixed = await tx.model.update({
          where: { id: modelId },
          data: { likesCount: 0 },
          select: { likesCount: true },
        });
        return fixed.likesCount;
      }
      return updated.likesCount;
    });

    return { liked: false, likesCount };
  }

  /**
   * 收藏（POST /api/models/:id/favorite）。逻辑与点赞对称。
   */
  async favorite(userId: bigint, modelId: bigint): Promise<FavoriteResult> {
    await this.ensureVisibleModel(modelId);

    const favoritesCount = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.favorite.findUnique({
        where: { userId_modelId: { userId, modelId } },
        select: { id: true },
      });
      if (existing) {
        return this.readFavoritesCount(tx, modelId);
      }
      await tx.favorite.create({ data: { userId, modelId } });
      const updated = await tx.model.update({
        where: { id: modelId },
        data: { favoritesCount: { increment: 1 } },
        select: { favoritesCount: true },
      });
      return updated.favoritesCount;
    });

    return { favorited: true, favoritesCount };
  }

  /**
   * 取消收藏（DELETE /api/models/:id/favorite）。逻辑与取消点赞对称。
   */
  async unfavorite(userId: bigint, modelId: bigint): Promise<FavoriteResult> {
    await this.ensureVisibleModel(modelId);

    const favoritesCount = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.favorite.findUnique({
        where: { userId_modelId: { userId, modelId } },
        select: { id: true },
      });
      if (!existing) {
        return this.readFavoritesCount(tx, modelId);
      }
      await tx.favorite.delete({ where: { id: existing.id } });
      const updated = await tx.model.update({
        where: { id: modelId },
        data: { favoritesCount: { decrement: 1 } },
        select: { favoritesCount: true },
      });
      if (updated.favoritesCount < 0) {
        const fixed = await tx.model.update({
          where: { id: modelId },
          data: { favoritesCount: 0 },
          select: { favoritesCount: true },
        });
        return fixed.favoritesCount;
      }
      return updated.favoritesCount;
    });

    return { favorited: false, favoritesCount };
  }

  // —— 内部工具 ——

  // 校验目标模型存在且对外可见（已发布 + 公开），否则 404
  private async ensureVisibleModel(modelId: bigint): Promise<void> {
    const model = await this.prisma.model.findFirst({
      where: { id: modelId, ...this.visibleWhere },
      select: { id: true },
    });
    if (!model) {
      throw new NotFoundException('模型不存在或暂未公开');
    }
  }

  // 事务内读回点赞计数（用于幂等分支）
  private async readLikesCount(
    tx: Prisma.TransactionClient,
    modelId: bigint,
  ): Promise<number> {
    const cur = await tx.model.findUnique({
      where: { id: modelId },
      select: { likesCount: true },
    });
    return cur?.likesCount ?? 0;
  }

  // 事务内读回收藏计数（用于幂等分支）
  private async readFavoritesCount(
    tx: Prisma.TransactionClient,
    modelId: bigint,
  ): Promise<number> {
    const cur = await tx.model.findUnique({
      where: { id: modelId },
      select: { favoritesCount: true },
    });
    return cur?.favoritesCount ?? 0;
  }
}
