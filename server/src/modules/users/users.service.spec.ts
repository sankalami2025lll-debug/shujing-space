import { NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('UsersService.deleteOwnModel', () => {
  const userId = BigInt(2);
  const modelId = BigInt(101);

  let prisma: {
    model: {
      findFirst: jest.Mock;
      update: jest.Mock;
      count: jest.Mock;
      findMany: jest.Mock;
    };
    favorite: { count: jest.Mock };
    trainingApplication: { count: jest.Mock };
    $transaction: jest.Mock;
  };
  let service: UsersService;

  beforeEach(() => {
    prisma = {
      model: {
        findFirst: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
        findMany: jest.fn(),
      },
      favorite: { count: jest.fn() },
      trainingApplication: { count: jest.fn() },
      $transaction: jest.fn(),
    };
    service = new UsersService(prisma as unknown as PrismaService);
  });

  it('删除自己的模型时写入 deletedAt / deletedBy', async () => {
    const deletedAt = new Date('2026-06-02T10:00:00.000Z');
    prisma.model.findFirst.mockResolvedValue({ id: modelId, deletedAt: null });
    prisma.model.update.mockResolvedValue({ id: modelId, deletedAt });

    const result = await service.deleteOwnModel(userId, modelId);

    expect(prisma.model.findFirst).toHaveBeenCalledWith({
      where: { id: modelId, userId },
      select: { id: true, deletedAt: true },
    });
    expect(prisma.model.update).toHaveBeenCalledWith({
      where: { id: modelId },
      data: expect.objectContaining({
        deletedAt: expect.any(Date),
        deletedBy: userId,
        deleteReason: null,
      }),
      select: { id: true, deletedAt: true },
    });
    expect(result).toEqual({ id: 101, deleted: true, deletedAt });
  });

  it('重复删除时幂等返回，不再更新', async () => {
    const deletedAt = new Date('2026-06-02T11:00:00.000Z');
    prisma.model.findFirst.mockResolvedValue({ id: modelId, deletedAt });

    const result = await service.deleteOwnModel(userId, modelId);

    expect(prisma.model.update).not.toHaveBeenCalled();
    expect(result).toEqual({ id: 101, deleted: true, deletedAt });
  });

  it('删除别人的模型或模型不存在时返回 404', async () => {
    prisma.model.findFirst.mockResolvedValue(null);

    await expect(service.deleteOwnModel(userId, modelId)).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.model.update).not.toHaveBeenCalled();
  });

  it('我的模型查询默认带 deletedAt=null 过滤', async () => {
    prisma.model.findFirst.mockReset();
    prisma.model.update.mockReset();
    prisma.model.count = jest.fn().mockResolvedValue(0);
    prisma.model.findMany = jest.fn().mockResolvedValue([]);
    prisma.$transaction.mockImplementation(async (tasks: Array<Promise<unknown>>) =>
      Promise.all(tasks),
    );

    const result = await service.findMyModels(userId, {
      status: 'all',
      page: 1,
      pageSize: 12,
    });

    expect(prisma.model.count).toHaveBeenCalledWith({
      where: { userId, deletedAt: null },
    });
    expect(prisma.model.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId, deletedAt: null },
      }),
    );
    expect(result.total).toBe(0);
  });

  it('stats 统计不包含已删除模型', async () => {
    prisma.favorite.count.mockResolvedValue(0);
    prisma.trainingApplication.count.mockResolvedValue(0);
    prisma.model.count = jest
      .fn()
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1);
    prisma.$transaction.mockImplementation(async (tasks: Array<Promise<unknown>>) =>
      Promise.all(tasks),
    );

    const stats = await service.getStats(userId);

    expect(prisma.model.count).toHaveBeenNthCalledWith(1, {
      where: { userId, deletedAt: null },
    });
    expect(prisma.model.count).toHaveBeenNthCalledWith(2, {
      where: { userId, status: 'published', deletedAt: null },
    });
    expect(prisma.model.count).toHaveBeenNthCalledWith(3, {
      where: { userId, status: 'pending', deletedAt: null },
    });
    expect(prisma.model.count).toHaveBeenNthCalledWith(4, {
      where: { userId, status: 'rejected', deletedAt: null },
    });
    expect(stats.models).toBe(3);
  });
});
