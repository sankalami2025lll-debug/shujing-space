import { FileKind } from '@prisma/client';

export interface ObjectHeadResult {
  size: number;
  mime: string;
}

export interface ObjectStorageService {
  readonly presignExpires: number;
  buildKey(kind: FileKind, userId: bigint, originalName: string): string;
  publicUrl(key: string): string;
  presignPut(key: string, mime: string): Promise<string>;
  headObject(key: string): Promise<ObjectHeadResult>;
}
