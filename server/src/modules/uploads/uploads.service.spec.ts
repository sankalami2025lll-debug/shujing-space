/**
 * 单元测试：UploadsService.callback / OssService.headObject
 * 用途：覆盖对象存储回执登记与 OSS 元数据读取的关键安全路径。
 */
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { FileKind } from '@prisma/client';
import { UploadsService } from './uploads.service';
import { OssCompatibleService } from './oss-compatible.service';
import { OssService } from './oss.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

describe('UploadsService.callback (2G)', () => {
  const userId = BigInt(2);
  const dto = {
    kind: 'model' as FileKind,
    objectKey: 'uploads/2/2026/06/11111111-1111-1111-1111-111111111111.glb',
    originalName: 'test.glb',
    mime: 'application/octet-stream',
    size: 1024,
  };

  let prisma: { modelFile: { create: jest.Mock } };
  let ossCompatible: {
    buildKey: jest.Mock;
    presignPut: jest.Mock;
    headObject: jest.Mock;
    publicUrl: jest.Mock;
    presignExpires: number;
  };
  let oss: {
    buildKey: jest.Mock;
    presignPut: jest.Mock;
    headObject: jest.Mock;
    publicUrl: jest.Mock;
    presignExpires: number;
  };
  let config: { get: jest.Mock };
  let storageDriver: 'oss-compatible' | 'oss';
  let service: UploadsService;

  beforeEach(() => {
    storageDriver = 'oss-compatible';
    prisma = { modelFile: { create: jest.fn().mockResolvedValue({ id: BigInt(99) }) } };
    ossCompatible = {
      buildKey: jest.fn((kind: string, uid: bigint, originalName: string) => {
        const ext = originalName.split('.').pop() ?? kind;
        return `uploads/${uid.toString()}/2026/06/test.${ext}`;
      }),
      presignPut: jest.fn().mockResolvedValue('https://signed.example/upload'),
      headObject: jest.fn(),
      publicUrl: jest.fn((key: string) => `https://assets.example/${key}`),
      presignExpires: 900,
    };
    oss = {
      buildKey: jest.fn((kind: string, uid: bigint, originalName: string) => {
        const ext = originalName.split('.').pop() ?? kind;
        return `uploads/${uid.toString()}/2026/06/test.${ext}`;
      }),
      presignPut: jest.fn().mockResolvedValue('https://oss-signed.example/upload'),
      headObject: jest.fn(),
      publicUrl: jest.fn((key: string) => `https://oss.example/${key}`),
      presignExpires: 900,
    };
    config = {
      get: jest.fn((key: string) => {
        if (key === 'storage.driver') return storageDriver;
        if (key === 'upload.maxModelBytes') return 500 * 1024 * 1024;
        if (key === 'upload.maxCoverBytes') return 5 * 1024 * 1024;
        return 0;
      }),
    };
    service = new UploadsService(
      prisma as unknown as PrismaService,
      ossCompatible as unknown as OssCompatibleService,
      oss as unknown as OssService,
      config as unknown as ConfigService,
    );
  });

  it('HeadObject 失败时不写入 model_files', async () => {
    ossCompatible.headObject.mockRejectedValue(
      new NotFoundException('对象存储中未找到该文件，请先完成上传'),
    );
    await expect(service.callback(userId, dto)).rejects.toThrow(NotFoundException);
    expect(prisma.modelFile.create).not.toHaveBeenCalled();
  });

  it('HeadObject 成功时写入 model_files（size/mime 以 Head 为准）', async () => {
    ossCompatible.headObject.mockResolvedValue({
      size: 2048,
      mime: 'application/octet-stream',
    });
    const res = await service.callback(userId, dto);
    expect(res.fileId).toBe(99);
    expect(prisma.modelFile.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId,
        r2Key: dto.objectKey,
        size: BigInt(2048),
        mime: 'application/octet-stream',
      }),
    });
  });

  it('越权 objectKey 返回 403 且不写库', async () => {
    await expect(
      service.callback(userId, { ...dto, objectKey: 'model/999/uuid.glb' }),
    ).rejects.toThrow(ForbiddenException);
    expect(ossCompatible.headObject).not.toHaveBeenCalled();
    expect(prisma.modelFile.create).not.toHaveBeenCalled();
  });

  it('OSS 驱动 callback 成功时以 OSS 元数据为准，不信任 DTO mime/size', async () => {
    storageDriver = 'oss';
    oss.headObject.mockResolvedValue({
      size: 333,
      mime: 'image/png',
    });

    const res = await service.callback(userId, {
      kind: 'cover',
      objectKey: 'uploads/2/2026/06/cover-test.png',
      originalName: 'cover-test.png',
      mime: 'application/octet-stream',
      size: 1,
    });

    expect(res.fileId).toBe(99);
    expect(oss.headObject).toHaveBeenCalledWith('uploads/2/2026/06/cover-test.png');
    expect(ossCompatible.headObject).not.toHaveBeenCalled();
    expect(prisma.modelFile.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId,
        kind: 'cover',
        r2Key: 'uploads/2/2026/06/cover-test.png',
        size: BigInt(333),
        mime: 'image/png',
      }),
    });
  });

  it('presign 返回 objectKey/method/headers，并兼容旧 r2Key/requiredHeaders', async () => {
    const res = await service.presign(userId, {
      kind: 'model',
      fileName: 'building.glb',
      mime: 'model/gltf-binary',
      size: 1024,
    });
    expect(res).toEqual({
      uploadUrl: 'https://signed.example/upload',
      objectKey: 'uploads/2/2026/06/test.glb',
      r2Key: 'uploads/2/2026/06/test.glb',
      publicUrl: 'https://assets.example/uploads/2/2026/06/test.glb',
      method: 'PUT',
      expiresIn: 900,
      headers: { 'Content-Type': 'model/gltf-binary' },
      requiredHeaders: { 'Content-Type': 'model/gltf-binary' },
    });
  });

  it('model zip presign 允许超过普通模型 500MB 上限的真实成果包', async () => {
    const res = await service.presign(userId, {
      kind: 'model',
      fileName: 'lcc-result.zip',
      mime: 'application/zip',
      size: 558509287,
    });

    expect(res.objectKey).toBe('uploads/2/2026/06/test.zip');
    expect(ossCompatible.presignPut).toHaveBeenCalledWith(
      'uploads/2/2026/06/test.zip',
      'application/zip',
    );
  });

  it('model 非 zip 仍受普通模型大小上限限制', async () => {
    await expect(
      service.presign(userId, {
        kind: 'model',
        fileName: 'too-large.glb',
        mime: 'model/gltf-binary',
        size: 558509287,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('callback 兼容旧 r2Key 别名', async () => {
    ossCompatible.headObject.mockResolvedValue({
      size: 2048,
      mime: 'application/octet-stream',
    });

    const res = await service.callback(userId, {
      kind: 'model',
      r2Key: 'uploads/2/2026/06/legacy.glb',
      originalName: 'legacy.glb',
      mime: 'application/octet-stream',
      size: 1024,
    });

    expect(res.objectKey).toBe('uploads/2/2026/06/legacy.glb');
    expect(res.r2Key).toBe('uploads/2/2026/06/legacy.glb');
    expect(ossCompatible.headObject).toHaveBeenCalledWith('uploads/2/2026/06/legacy.glb');
  });
});

describe('OssService.headObject', () => {
  const ossConfig = {
    accessKeyId: 'test-ak',
    accessKeySecret: 'test-sk',
    bucket: 'shujingspace',
    region: 'oss-cn-shenzhen',
    endpoint: 'https://oss-cn-shenzhen.aliyuncs.com',
    publicBase: 'https://shujingspace.oss-cn-shenzhen.aliyuncs.com',
    presignExpires: 900,
  };

  let config: { get: jest.Mock };
  let client: { head: jest.Mock; getObjectMeta: jest.Mock };
  let service: OssService;

  beforeEach(() => {
    config = {
      get: jest.fn((key: string) => {
        if (key === 'oss') return ossConfig;
        return undefined;
      }),
    };
    client = {
      head: jest.fn(),
      getObjectMeta: jest.fn(),
    };
    service = new OssService(config as unknown as ConfigService);
    (service as unknown as { client: typeof client }).client = client;
  });

  it('head 返回 content-type 时可识别 MIME，size 仍以 OSS metadata 为准', async () => {
    client.head.mockResolvedValue({
      res: { headers: { 'Content-Type': 'image/png', 'content-length': '10' } },
    });
    client.getObjectMeta.mockResolvedValue({
      res: { headers: { 'content-length': '2048' } },
    });

    await expect(service.headObject('uploads/2/2026/06/test.png')).resolves.toEqual({
      size: 2048,
      mime: 'image/png',
    });
  });

  it('head 缺少 content-type 时返回 400', async () => {
    client.head.mockResolvedValue({
      res: { headers: { 'content-length': '10' } },
      meta: null,
    });
    client.getObjectMeta.mockResolvedValue({
      res: { headers: { 'content-length': '2048' } },
    });

    await expect(service.headObject('uploads/2/2026/06/test.png')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('兼容从 x-oss-meta-content-type 读取 MIME', async () => {
    client.head.mockResolvedValue({
      res: { headers: { 'x-oss-meta-content-type': 'image/webp' } },
    });
    client.getObjectMeta.mockResolvedValue({
      res: { headers: { 'content-length': '4096' } },
    });

    await expect(service.headObject('uploads/2/2026/06/test.webp')).resolves.toEqual({
      size: 4096,
      mime: 'image/webp',
    });
  });
});
