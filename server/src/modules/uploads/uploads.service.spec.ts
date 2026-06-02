/**
 * 单元测试：UploadsService.callback（2G R2 上传安全增强）
 * 用途：mock HeadObject 成功/失败，验证是否写入 model_files。
 */
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { FileKind } from '@prisma/client';
import { UploadsService } from './uploads.service';
import { R2Service } from './r2.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

describe('UploadsService.callback (2G)', () => {
  const userId = BigInt(2);
  const dto = {
    kind: 'model' as FileKind,
    r2Key: 'model/2/11111111-1111-1111-1111-111111111111.glb',
    originalName: 'test.glb',
    mime: 'application/octet-stream',
    size: 1024,
  };

  let prisma: { modelFile: { create: jest.Mock } };
  let r2: { headObject: jest.Mock; publicUrl: jest.Mock };
  let config: { get: jest.Mock };
  let service: UploadsService;

  beforeEach(() => {
    prisma = { modelFile: { create: jest.fn().mockResolvedValue({ id: BigInt(99) }) } };
    r2 = {
      headObject: jest.fn(),
      publicUrl: jest.fn((key: string) => `https://assets.example/${key}`),
    };
    config = {
      get: jest.fn((key: string) => {
        if (key === 'upload.maxModelBytes') return 500 * 1024 * 1024;
        if (key === 'upload.maxCoverBytes') return 5 * 1024 * 1024;
        return 0;
      }),
    };
    service = new UploadsService(
      prisma as unknown as PrismaService,
      r2 as unknown as R2Service,
      config as unknown as ConfigService,
    );
  });

  it('HeadObject 失败时不写入 model_files', async () => {
    r2.headObject.mockRejectedValue(
      new NotFoundException('对象存储中未找到该文件，请先完成上传'),
    );
    await expect(service.callback(userId, dto)).rejects.toThrow(NotFoundException);
    expect(prisma.modelFile.create).not.toHaveBeenCalled();
  });

  it('HeadObject 成功时写入 model_files（size/mime 以 Head 为准）', async () => {
    r2.headObject.mockResolvedValue({
      size: 2048,
      mime: 'application/octet-stream',
    });
    const res = await service.callback(userId, dto);
    expect(res.fileId).toBe(99);
    expect(prisma.modelFile.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId,
        r2Key: dto.r2Key,
        size: BigInt(2048),
        mime: 'application/octet-stream',
      }),
    });
  });

  it('越权 r2Key 返回 403 且不写库', async () => {
    await expect(
      service.callback(userId, { ...dto, r2Key: 'model/999/uuid.glb' }),
    ).rejects.toThrow(ForbiddenException);
    expect(r2.headObject).not.toHaveBeenCalled();
    expect(prisma.modelFile.create).not.toHaveBeenCalled();
  });
});
