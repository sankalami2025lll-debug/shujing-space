import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ModelsService } from './models.service';
import { PrismaService } from '../../prisma/prisma.service';
import { LccZipService } from './lcc-zip.service';

describe('ModelsService soft-delete visibility', () => {
  const modelId = BigInt(401);
  const authorId = BigInt(7);

  let prisma: {
    model: {
      count: jest.Mock;
      findMany: jest.Mock;
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    category: {
      findUnique: jest.Mock;
    };
    $transaction: jest.Mock;
    like: { findMany: jest.Mock };
    favorite: { findMany: jest.Mock };
  };
  const config = {
    get: jest.fn().mockReturnValue({ allowedHosts: ['viewer.example.com'] }),
  };
  const lccZipService = {
    processUploadedZip: jest.fn(),
  };
  let service: ModelsService;

  beforeEach(() => {
    prisma = {
      model: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      category: {
        findUnique: jest.fn().mockResolvedValue(null),
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
      config as unknown as ConfigService,
      lccZipService as unknown as LccZipService,
    );
    lccZipService.processUploadedZip.mockReset();
  });

  it('公开列表默认带 deletedAt=null 过滤', async () => {
    const result = await service.findList(
      { page: 1, pageSize: 12, sort: 'latest' },
      undefined,
    );

    expect(prisma.model.count).toHaveBeenCalledWith({
      where: expect.objectContaining({ deletedAt: null, processingStatus: 'ready' }),
    });
    expect(prisma.model.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ deletedAt: null, processingStatus: 'ready' }),
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
            {
              status: 'published',
              visibility: 'public',
              processingStatus: 'ready',
              deletedAt: null,
            },
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
      where: {
        id: modelId,
        status: 'published',
        visibility: 'public',
        processingStatus: 'ready',
        deletedAt: null,
      },
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
      processingStatus: 'ready',
      processingError: null,
      processedAt: new Date('2026-06-02T12:05:00.000Z'),
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

  it('外链发布默认写入 ready，并记录 processedAt', async () => {
    prisma.model.create.mockResolvedValue({
      id: modelId,
      userId: authorId,
      title: '外链模型',
      type: 'BIM',
      tags: [],
      scenes: [],
      description: '',
      coverUrl: '',
      modelUrl: 'https://viewer.example.com/embed/1',
      viewerType: 'iframe',
      allowIframe: true,
      fileFormat: null,
      viewsCount: 0,
      likesCount: 0,
      favoritesCount: 0,
      createdAt: new Date('2026-06-02T12:00:00.000Z'),
      processingStatus: 'ready',
      processingError: null,
      processedAt: new Date('2026-06-02T12:01:00.000Z'),
      status: 'published',
      visibility: 'public',
      rejectReason: null,
      user: { nickname: '作者A' },
      category: null,
    });

    const result = await service.create(authorId, {
      title: '外链模型',
      type: 'BIM',
      visibility: 'public',
      viewerUrl: 'https://viewer.example.com/embed/1',
      viewerType: 'iframe',
      allowIframe: true,
    });

    expect(prisma.model.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          modelUrl: 'https://viewer.example.com/embed/1',
          processingStatus: 'ready',
          processingError: null,
          processedAt: expect.any(Date),
        }),
      }),
    );
    expect(result.processingStatus).toBe('ready');
  });

  it('原生文件上传发布默认写入 processing', async () => {
    prisma.model.create.mockResolvedValue({
      id: modelId,
      userId: authorId,
      title: '上传模型',
      type: 'BIM',
      tags: [],
      scenes: [],
      description: '',
      coverUrl: 'https://example.com/cover.png',
      modelUrl: 'https://example.com/model.glb',
      viewerType: 'native',
      allowIframe: true,
      fileFormat: 'glb',
      viewsCount: 0,
      likesCount: 0,
      favoritesCount: 0,
      createdAt: new Date('2026-06-02T12:00:00.000Z'),
      processingStatus: 'processing',
      processingError: null,
      processedAt: null,
      status: 'published',
      visibility: 'public',
      rejectReason: null,
      user: { nickname: '作者A' },
      category: null,
    });
    (service as unknown as {
      findOwnedFile: (
        userId: bigint,
        fileId: number,
        kind: string,
      ) => Promise<{ id: bigint; originalName: string; url: string }>;
    }).findOwnedFile = async (_userId: bigint, fileId: number, kind: string) => {
        if (kind === 'model') {
          return {
            id: BigInt(fileId),
            originalName: 'building.glb',
            url: 'https://example.com/model.glb',
          };
        }
        return {
          id: BigInt(fileId),
          originalName: 'cover.png',
          url: 'https://example.com/cover.png',
        };
      };

    const result = await service.create(authorId, {
      title: '上传模型',
      type: 'BIM',
      visibility: 'public',
      modelFileId: 11,
      coverFileId: 12,
    });

    expect(prisma.model.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          fileFormat: 'glb',
          processingStatus: 'processing',
          processedAt: null,
        }),
      }),
    );
    expect(result.processingStatus).toBe('processing');
  });

  it('预留方法可更新解析状态', async () => {
    prisma.model.update.mockResolvedValue({ id: modelId });

    await service.markProcessing(modelId);
    await service.markReady(modelId, {
      viewerUrl: 'https://viewer.example.com/next',
      fileFormat: 'lcc',
      viewerType: 'native',
    });
    await service.markFailed(modelId, '解析失败');

    expect(prisma.model.update).toHaveBeenNthCalledWith(1, {
      where: { id: modelId },
      data: {
        processingStatus: 'processing',
        processingError: null,
        processedAt: null,
      },
    });
    expect(prisma.model.update).toHaveBeenNthCalledWith(2, {
      where: { id: modelId },
      data: {
        processingStatus: 'ready',
        processingError: null,
        processedAt: expect.any(Date),
        modelUrl: 'https://viewer.example.com/next',
        fileFormat: 'lcc',
        viewerType: 'native',
      },
    });
    expect(prisma.model.update).toHaveBeenNthCalledWith(3, {
      where: { id: modelId },
      data: {
        processingStatus: 'failed',
        processingError: '解析失败',
        processedAt: null,
      },
    });
  });

  it('ZIP 上传成功时回写 LCC 入口地址与格式', async () => {
    prisma.model.findUnique = jest.fn().mockResolvedValue({
      id: modelId,
      userId: authorId,
      title: 'LCC ZIP 模型',
      type: 'BIM',
      tags: [],
      scenes: [],
      description: '',
      coverUrl: '',
      modelUrl: 'https://example.com/processed/meta.lcc',
      viewerType: 'native',
      allowIframe: true,
      fileFormat: 'lcc',
      viewsCount: 0,
      likesCount: 0,
      favoritesCount: 0,
      createdAt: new Date('2026-06-02T12:00:00.000Z'),
      processingStatus: 'ready',
      processingError: null,
      processedAt: new Date('2026-06-02T12:03:00.000Z'),
      status: 'published',
      visibility: 'public',
      rejectReason: null,
      user: { nickname: '作者A' },
      category: null,
    });
    prisma.model.create.mockResolvedValue({
      id: modelId,
      userId: authorId,
      title: 'LCC ZIP 模型',
      type: 'BIM',
      tags: [],
      scenes: [],
      description: '',
      coverUrl: '',
      modelUrl: 'https://example.com/source.zip',
      viewerType: 'native',
      allowIframe: true,
      fileFormat: 'zip',
      viewsCount: 0,
      likesCount: 0,
      favoritesCount: 0,
      createdAt: new Date('2026-06-02T12:00:00.000Z'),
      processingStatus: 'processing',
      processingError: null,
      processedAt: null,
      status: 'published',
      visibility: 'public',
      rejectReason: null,
      user: { nickname: '作者A' },
      category: null,
    });
    prisma.model.update.mockResolvedValue({ id: modelId });
    (service as unknown as {
      findOwnedFile: (
        userId: bigint,
        fileId: number,
        kind: string,
      ) => Promise<{ id: bigint; originalName: string; url: string; objectKey: string }>;
    }).findOwnedFile = async (_userId: bigint, fileId: number, kind: string) => {
      if (kind === 'model') {
        return {
          id: BigInt(fileId),
          originalName: 'scene.zip',
          url: 'https://example.com/source.zip',
          objectKey: 'uploads/7/2026/06/source.zip',
        };
      }
      return {
        id: BigInt(fileId),
        originalName: 'cover.png',
        url: 'https://example.com/cover.png',
        objectKey: 'uploads/7/2026/06/cover.png',
      };
    };
    lccZipService.processUploadedZip.mockResolvedValue({
      entryUrl: 'https://example.com/processed/meta.lcc',
      fileFormat: 'lcc',
      entryRelativePath: 'meta.lcc',
      uploadedFileCount: 2,
    });

    const result = await service.create(authorId, {
      title: 'LCC ZIP 模型',
      type: 'BIM',
      visibility: 'public',
      modelFileId: 11,
    });

    expect(lccZipService.processUploadedZip).toHaveBeenCalledWith(
      modelId,
      'uploads/7/2026/06/source.zip',
    );
    expect(prisma.model.update).toHaveBeenCalledWith({
      where: { id: modelId },
      data: expect.objectContaining({
        processingStatus: 'ready',
        modelUrl: 'https://example.com/processed/meta.lcc',
        fileFormat: 'lcc',
        viewerType: 'native',
      }),
    });
    expect(result.fileFormat).toBe('lcc');
    expect(result.viewerUrl).toBe('https://example.com/processed/meta.lcc');
  });

  it('ZIP 处理失败时写入 failed 与失败原因', async () => {
    prisma.model.findUnique = jest.fn().mockResolvedValue({
      id: modelId,
      userId: authorId,
      title: '失败 ZIP 模型',
      type: 'BIM',
      tags: [],
      scenes: [],
      description: '',
      coverUrl: '',
      modelUrl: 'https://example.com/source.zip',
      viewerType: 'native',
      allowIframe: true,
      fileFormat: 'zip',
      viewsCount: 0,
      likesCount: 0,
      favoritesCount: 0,
      createdAt: new Date('2026-06-02T12:00:00.000Z'),
      processingStatus: 'failed',
      processingError: '未找到 LCC/LCC2 入口文件',
      processedAt: null,
      status: 'published',
      visibility: 'public',
      rejectReason: null,
      user: { nickname: '作者A' },
      category: null,
    });
    prisma.model.create.mockResolvedValue({
      id: modelId,
      userId: authorId,
      title: '失败 ZIP 模型',
      type: 'BIM',
      tags: [],
      scenes: [],
      description: '',
      coverUrl: '',
      modelUrl: 'https://example.com/source.zip',
      viewerType: 'native',
      allowIframe: true,
      fileFormat: 'zip',
      viewsCount: 0,
      likesCount: 0,
      favoritesCount: 0,
      createdAt: new Date('2026-06-02T12:00:00.000Z'),
      processingStatus: 'processing',
      processingError: null,
      processedAt: null,
      status: 'published',
      visibility: 'public',
      rejectReason: null,
      user: { nickname: '作者A' },
      category: null,
    });
    prisma.model.update.mockResolvedValue({ id: modelId });
    (service as unknown as {
      findOwnedFile: (
        userId: bigint,
        fileId: number,
        kind: string,
      ) => Promise<{ id: bigint; originalName: string; url: string; objectKey: string }>;
    }).findOwnedFile = async (_userId: bigint, fileId: number, kind: string) => {
      if (kind === 'model') {
        return {
          id: BigInt(fileId),
          originalName: 'scene.zip',
          url: 'https://example.com/source.zip',
          objectKey: 'uploads/7/2026/06/source.zip',
        };
      }
      return {
        id: BigInt(fileId),
        originalName: 'cover.png',
        url: 'https://example.com/cover.png',
        objectKey: 'uploads/7/2026/06/cover.png',
      };
    };
    lccZipService.processUploadedZip.mockRejectedValue(
      new Error('未找到 LCC/LCC2 入口文件'),
    );

    const result = await service.create(authorId, {
      title: '失败 ZIP 模型',
      type: 'BIM',
      visibility: 'public',
      modelFileId: 11,
    });

    expect(prisma.model.update).toHaveBeenCalledWith({
      where: { id: modelId },
      data: {
        processingStatus: 'failed',
        processingError: '未找到 LCC/LCC2 入口文件',
        processedAt: null,
      },
    });
    expect(result.processingStatus).toBe('failed');
    expect(result.processingError).toBe('未找到 LCC/LCC2 入口文件');
  });
});
