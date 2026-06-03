import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ModelsService } from './models.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('ModelsService soft-delete visibility', () => {
  const modelId = BigInt(401);
  const authorId = BigInt(7);

  let prisma: {
    model: {
      count: jest.Mock;
      findMany: jest.Mock;
      findFirst: jest.Mock;
    };
    $transaction: jest.Mock;
    like: { findMany: jest.Mock };
    favorite: { findMany: jest.Mock };
  };
  let service: ModelsService;

  beforeEach(() => {
    prisma = {
      model: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn(),
      },
      $transaction: jest.fn(),
      like: { findMany: jest.fn().mockResolvedValue([]) },
      favorite: { findMany: jest.fn().mockResolvedValue([]) },
    };
    prisma.$transaction.mockImplementation(async (tasks: Array<Promise<unknown>>) =>
      Promise.all(tasks),
    );
    service = new ModelsService(
      prisma as unknown as PrismaService,
      {} as ConfigService,
    );
  });

  it('公开列表默认带 deletedAt=null 过滤', async () => {
    const result = await service.findList(
      { page: 1, pageSize: 12, sort: 'latest' },
      undefined,
    );

    expect(prisma.model.count).toHaveBeenCalledWith({
      where: expect.objectContaining({ deletedAt: null }),
    });
    expect(prisma.model.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ deletedAt: null }),
      }),
    );
    expect(result.total).toBe(0);
  });

  it('作者也不能查看已删除模型详情', async () => {
    prisma.model.findFirst.mockResolvedValue(null);

    await expect(service.findOne(modelId, authorId)).rejects.toThrow(NotFoundException);
    expect(prisma.model.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: modelId,
          OR: [
            { status: 'published', visibility: 'public', deletedAt: null },
            { userId: authorId, deletedAt: null },
          ],
        },
      }),
    );
  });

  it('已删除模型不能增加浏览量', async () => {
    prisma.model.findFirst.mockResolvedValue(null);

    await expect(service.recordView(modelId)).rejects.toThrow(NotFoundException);
    expect(prisma.model.findFirst).toHaveBeenCalledWith({
      where: { id: modelId, status: 'published', visibility: 'public', deletedAt: null },
      select: { id: true },
    });
  });

  it('详情返回作者 userId 供前端判断删除入口', async () => {
    prisma.model.findFirst.mockResolvedValue({
      id: modelId,
      userId: authorId,
      title: '测试模型',
      type: 'BIM',
      tags: [],
      scenes: [],
      description: 'desc',
      coverUrl: '',
      modelUrl: 'https://example.com/viewer',
      viewerType: 'iframe',
      allowIframe: true,
      fileFormat: 'glb',
      viewsCount: 12,
      likesCount: 3,
      favoritesCount: 4,
      createdAt: new Date('2026-06-02T12:00:00.000Z'),
      status: 'published',
      visibility: 'public',
      rejectReason: null,
      user: { nickname: '作者A' },
      category: null,
    });

    const result = await service.findOne(modelId, authorId);

    expect(result.userId).toBe(Number(authorId));
    expect(result.author).toBe('作者A');
  });
});
