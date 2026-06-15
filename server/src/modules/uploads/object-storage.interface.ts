import { FileKind } from '@prisma/client';

export interface ObjectHeadResult {
  size: number;
  mime: string;
}

export interface PutObjectResult {
  key: string;
  url: string;
}

export interface MultipartPartDescriptor {
  partNumber: number;
  etag: string;
}

export interface MultipartInitResult {
  uploadId: string;
}

export interface ObjectStorageService {
  readonly presignExpires: number;
  buildKey(kind: FileKind, userId: bigint, originalName: string): string;
  publicUrl(key: string): string;
  presignPut(key: string, mime: string): Promise<string>;
  initiateMultipartUpload(key: string, mime: string): Promise<MultipartInitResult>;
  presignUploadPart(
    key: string,
    uploadId: string,
    partNumber: number,
  ): Promise<string>;
  completeMultipartUpload(
    key: string,
    uploadId: string,
    parts: MultipartPartDescriptor[],
  ): Promise<void>;
  abortMultipartUpload(key: string, uploadId: string): Promise<void>;
  headObject(key: string): Promise<ObjectHeadResult>;
  downloadObject(key: string): Promise<Buffer>;
  putObject(key: string, body: Buffer, contentType: string): Promise<PutObjectResult>;
  /**
   * 服务端 putObjectMultipart: 对 >32MB 的大文件使用分片上传，小文件回退 putObject
   * @param concurrency 内部并发数（分片级别，仅大文件有效）
   */
  putObjectMultipart(
    key: string,
    body: Buffer,
    contentType: string,
    concurrency?: number,
    partSize?: number,
  ): Promise<PutObjectResult>;
}
