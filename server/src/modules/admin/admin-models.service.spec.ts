import { NotFoundException } from '@nestjs/common';
import { AdminModelsService } from './admin-models.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('AdminModelsService.softDelete', () => {
  const modelId = BigInt(201);
  const adminId = BigInt(1);

  let prisma: {
    model: {
      findUnique: jest.Mock;
      update: jest.Mock;
      count: jest.Mock;
      findMany: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let service: AdminModelsService;

  beforeEach(() => {
    prisma = {
      model: {
        findUnique: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
        findMany: jest.fn(),
      },
      $transaction: jest.fn(),
    };
    service = new AdminModelsService(prisma as unknown as PrismaService);
  });

  it('管理员删除模型时写入 deletedAt / deletedBy / deleteReason', async () => {
    const deletedAt = new Date('2026-06-02T12:00:00.000Z');
    prisma.model.findUnique.mockResolvedValue({ id: modelId, deletedAt: null });
    prisma.model.update.mockResolvedValue({ id: modelId, deletedAt });

    const result = await service.softDelete(modelId, adminId, {
      deleteReason: '违规内容',
    });

    expect(prisma.model.findUnique).toHaveBeenCalledWith({
      where: { id: modelId },
      select: { id: true, deletedAt: true },
    });
    expect(prisma.model.update).toHaveBeenCalledWith({
      where: { id: modelId },
      data: expect.objectContaining({
        deletedAt: expect.any(Date),
        deletedBy: adminId,
        deleteReason: '违规内容',
      }),
      select: { id: true, deletedAt: true },
    });
    expect(result).toEqual({ id: 201, deleted: true, deletedAt });
  });

  it('重复删除时幂等返回，不再更新', async () => {
    const deletedAt = new Date('2026-06-02T13:00:00.000Z');
    prisma.model.findUnique.mockResolvedValue({ id: modelId, deletedAt });

    const result = await service.softDelete(modelId, adminId, {
      deleteReason: '重复请求',
    });

    expect(prisma.model.update).not.toHaveBeenCalled();
    expect(result).toEqual({ id: 201, deleted: true, deletedAt });
  });

  it('模型不存在时返回 404', async () => {
    prisma.model.findUnique.mockResolvedValue(null);

    await expect(service.softDelete(modelId, adminId, {})).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.model.update).not.toHaveBeenCalled();
  });

  it('后台列表默认只查未删除模型', async () => {
    prisma.model.findUnique.mockReset();
    prisma.model.update.mockReset();
    prisma.model.count = jest.fn().mockResolvedValue(0);
    prisma.model.findMany = jest.fn().mockResolvedValue([]);
    prisma.$transaction.mockImplementation(async (tasks: Array<Promise<unknown>>) =>
      Promise.all(tasks),
    );

    const result = await service.findList({
      status: 'all',
      type: undefined,
      keyword: undefined,
      page: 1,
      pageSize: 10,
    });

    expect(prisma.model.count).toHaveBeenCalledWith({
      where: { deletedAt: null },
    });
    expect(prisma.model.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { deletedAt: null },
      }),
    );
    expect(result.total).toBe(0);
  });
});
