import { FileKind } from '@prisma/client';

export interface ObjectHeadResult {
  size: number;
  mime: string;
}

export interface PutObjectResult {
  key: string;
  url: string;
}

export interface ObjectStorageService {
  readonly presignExpires: number;
  buildKey(kind: FileKind, userId: bigint, originalName: string): string;
  publicUrl(key: string): string;
  presignPut(key: string, mime: string): Promise<string>;
  headObject(key: string): Promise<ObjectHeadResult>;
  downloadObject(key: string): Promise<Buffer>;
  putObject(key: string, body: Buffer, contentType: string): Promise<PutObjectResult>;
}
