import { NotFoundException } from '@nestjs/common';
import { InteractionsService } from './interactions.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('InteractionsService', () => {
  const userId = BigInt(2);
  const modelId = BigInt(301);

  let prisma: {
    model: {
      findFirst: jest.Mock;
      findUnique: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let service: InteractionsService;

  beforeEach(() => {
    prisma = {
      model: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
      },
      $transaction: jest.fn(),
    };
    service = new InteractionsService(prisma as unknown as PrismaService);
  });

  it('已删除模型不能点赞，返回 404', async () => {
    prisma.model.findFirst.mockResolvedValue(null);

    await expect(service.like(userId, modelId)).rejects.toThrow(NotFoundException);
    expect(prisma.model.findFirst).toHaveBeenCalledWith({
      where: {
        id: modelId,
        status: 'published',
        visibility: 'public',
        processingStatus: 'ready',
        deletedAt: null,
      },
      select: { id: true },
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('已删除模型允许取消点赞并走幂等事务逻辑', async () => {
    const tx = {
      like: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
      model: {
        findUnique: jest.fn().mockResolvedValue({ likesCount: 5 }),
      },
    };
    prisma.model.findUnique.mockResolvedValue({ id: modelId });
    prisma.$transaction.mockImplementation(async (cb: (client: typeof tx) => unknown) => cb(tx));

    const result = await service.unlike(userId, modelId);

    expect(prisma.model.findUnique).toHaveBeenCalledWith({
      where: { id: modelId },
      select: { id: true },
    });
    expect(result).toEqual({ liked: false, likesCount: 5 });
  });

  it('已删除模型不能新增收藏，返回 404', async () => {
    prisma.model.findFirst.mockResolvedValue(null);

    await expect(service.favorite(userId, modelId)).rejects.toThrow(NotFoundException);
    expect(prisma.model.findFirst).toHaveBeenCalledWith({
      where: {
        id: modelId,
        status: 'published',
        visibility: 'public',
        processingStatus: 'ready',
        deletedAt: null,
      },
      select: { id: true },
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
