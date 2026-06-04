import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AdminModelsService } from './admin-models.service';
import { ModelsService } from '../models/models.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('AdminModelsService', () => {
  const modelId = BigInt(201);
  const adminId = BigInt(1);
  const includedModel = {
    id: modelId,
    title: '测试模型',
    type: 'BIM',
    tags: [],
    scenes: [],
    description: 'desc',
    userId: BigInt(2),
    user: { id: BigInt(2), nickname: '作者' },
    category: null,
    coverUrl: '',
    modelUrl: 'https://viewer.example.com/model',
    viewerType: 'native',
    allowIframe: true,
    fileFormat: 'glb',
    viewsCount: 0,
    likesCount: 0,
    favoritesCount: 0,
    visibility: 'public',
    status: 'published',
    processingStatus: 'processing',
    processingError: null,
    processedAt: null,
    deletedAt: null,
    deletedBy: null,
    rejectReason: null,
    deleteReason: null,
    createdAt: new Date('2026-06-01T00:00:00.000Z'),
    updatedAt: new Date('2026-06-01T00:00:00.000Z'),
  };

  let prisma: {
    model: {
      findUnique: jest.Mock;
      update: jest.Mock;
      count: jest.Mock;
      findMany: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let modelsService: {
    markReady: jest.Mock;
    markFailed: jest.Mock;
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
    modelsService = {
      markReady: jest.fn(),
      markFailed: jest.fn(),
    };
    service = new AdminModelsService(
      prisma as unknown as PrismaService,
      modelsService as unknown as ModelsService,
    );
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

  it('mark_ready 时复用 ModelsService.markReady 并返回最新模型', async () => {
    prisma.model.findUnique
      .mockResolvedValueOnce({ id: modelId })
      .mockResolvedValueOnce({
        ...includedModel,
        processingStatus: 'ready',
        processedAt: new Date('2026-06-04T10:00:00.000Z'),
      });

    const result = await service.updateProcessingStatus(modelId, {
      action: 'mark_ready',
    });

    expect(modelsService.markReady).toHaveBeenCalledWith(modelId);
    expect(modelsService.markFailed).not.toHaveBeenCalled();
    expect(result.processingStatus).toBe('ready');
  });

  it('mark_failed 时复用 ModelsService.markFailed 并写入原因', async () => {
    prisma.model.findUnique
      .mockResolvedValueOnce({ id: modelId })
      .mockResolvedValueOnce({
        ...includedModel,
        processingStatus: 'failed',
        processingError: '模型文件损坏',
      });

    const result = await service.updateProcessingStatus(modelId, {
      action: 'mark_failed',
      reason: '  模型文件损坏  ',
    });

    expect(modelsService.markFailed).toHaveBeenCalledWith(modelId, '模型文件损坏');
    expect(modelsService.markReady).not.toHaveBeenCalled();
    expect(result.processingStatus).toBe('failed');
    expect(result.processingError).toBe('模型文件损坏');
  });

  it('mark_failed 缺少原因时返回 400', async () => {
    prisma.model.findUnique.mockResolvedValue({ id: modelId });

    await expect(
      service.updateProcessingStatus(modelId, {
        action: 'mark_failed',
        reason: '   ',
      }),
    ).rejects.toThrow(new BadRequestException('请填写解析失败原因'));
    expect(modelsService.markFailed).not.toHaveBeenCalled();
  });

  it('更新处理状态时模型不存在返回 404', async () => {
    prisma.model.findUnique.mockResolvedValue(null);

    await expect(
      service.updateProcessingStatus(modelId, {
        action: 'mark_ready',
      }),
    ).rejects.toThrow(NotFoundException);
    expect(modelsService.markReady).not.toHaveBeenCalled();
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
