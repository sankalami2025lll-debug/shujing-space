import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import yauzl from 'yauzl';
import { OssCompatibleService } from '../uploads/oss-compatible.service';
import { OssService } from '../uploads/oss.service';
import { ObjectStorageService } from '../uploads/object-storage.interface';

const LCC_ZIP_ALLOWED_EXTENSIONS = new Set([
  'lcc',
  'lcc2',
  'lcp',
  'lci',
  'json',
  'bin',
  'sog',
  'btree',
  'ply',
  'png',
  'jpg',
  'jpeg',
  'webp',
  'ktx2',
  'basis',
  'wasm',
  'txt',
]);

const MAX_ZIP_FILE_COUNT = 2000;
const MAX_ZIP_SINGLE_FILE_BYTES = 1024 * 1024 * 1024;
const MAX_ZIP_TOTAL_UNCOMPRESSED_BYTES = 1024 * 1024 * 1024;
const MAX_ZIP_DIRECTORY_DEPTH = 8;

interface ExtractedZipFile {
  absolutePath: string;
  relativePath: string;
  size: number;
}

export interface LccZipProcessResult {
  entryUrl: string;
  fileFormat: 'lcc' | 'lcc2';
  entryRelativePath: string;
  uploadedFileCount: number;
}

@Injectable()
export class LccZipService {
  private readonly logger = new Logger(LccZipService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly ossCompatible: OssCompatibleService,
    private readonly oss: OssService,
  ) {}

  async processUploadedZip(modelId: bigint, objectKey: string): Promise<LccZipProcessResult> {
    const tempRoot = await mkdtemp(path.join(tmpdir(), 'shujing-lcc-zip-'));
    const zipPath = path.join(tempRoot, 'source.zip');
    const extractDir = path.join(tempRoot, 'extracted');

    try {
      const archiveBuffer = await this.storage.downloadObject(objectKey);
      await writeFile(zipPath, archiveBuffer);
      await mkdir(extractDir, { recursive: true });

      const extractedFiles = await this.extractZipSafely(zipPath, extractDir);
      const lccEntries = extractedFiles.filter((file) => {
        const ext = path.extname(file.relativePath).toLowerCase();
        return ext === '.lcc' || ext === '.lcc2';
      });

      if (lccEntries.length === 0) {
        throw new BadRequestException('未找到 LCC/LCC2 入口文件');
      }
      if (lccEntries.length > 1) {
        throw new BadRequestException('检测到多个 LCC/LCC2 入口文件，请只保留一个');
      }

      const entryFile = lccEntries[0];
      const fileFormat = path.extname(entryFile.relativePath).toLowerCase() === '.lcc2' ? 'lcc2' : 'lcc';

      const uploadedEntries = new Map<string, string>();
      let uploadIndex = 0;
      for (const file of extractedFiles) {
        uploadIndex += 1;
        const targetKey = this.buildProcessedObjectKey(modelId, file.relativePath);
        this.logger.log(
          `[LCCZip] uploading file ${uploadIndex}/${extractedFiles.length} | modelId=${modelId} source=${file.relativePath} targetKey=${targetKey} size=${file.size}`,
        );
        const content = await readFile(file.absolutePath);
        const uploaded = await this.storage.putObject(
          targetKey,
          content,
          this.inferContentType(file.relativePath),
        );
        uploadedEntries.set(file.relativePath, uploaded.url);
      }

      const entryUrl = uploadedEntries.get(entryFile.relativePath);
      if (!entryUrl) {
        throw new InternalServerErrorException('入口文件上传完成后未返回可访问地址');
      }

      return {
        entryUrl,
        fileFormat,
        entryRelativePath: entryFile.relativePath,
        uploadedFileCount: extractedFiles.length,
      };
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  }

  private get storage(): ObjectStorageService {
    return (this.config.get<'oss-compatible' | 'oss'>('storage.driver') ?? 'oss') === 'oss'
      ? this.oss
      : this.ossCompatible;
  }

  private buildProcessedObjectKey(modelId: bigint, relativePath: string): string {
    const normalized = relativePath.replace(/\\/g, '/');
    return `processed/lcc/${modelId.toString()}/${normalized}`;
  }

  private inferContentType(filePath: string): string {
    switch (path.extname(filePath).toLowerCase()) {
      case '.json':
        return 'application/json';
      case '.png':
        return 'image/png';
      case '.jpg':
      case '.jpeg':
        return 'image/jpeg';
      case '.webp':
        return 'image/webp';
      case '.ktx2':
        return 'image/ktx2';
      case '.wasm':
        return 'application/wasm';
      case '.txt':
        return 'text/plain; charset=utf-8';
      case '.lcc':
      case '.lcc2':
      case '.bin':
      case '.basis':
      default:
        return 'application/octet-stream';
    }
  }

  private async extractZipSafely(zipPath: string, extractDir: string): Promise<ExtractedZipFile[]> {
    const zipFile = await this.openZip(zipPath);
    const extractedFiles: ExtractedZipFile[] = [];
    let fileCount = 0;
    let totalSize = 0;

    return new Promise<ExtractedZipFile[]>((resolve, reject) => {
      let settled = false;

      const finish = (callback: () => void) => {
        if (settled) return;
        settled = true;
        zipFile.removeAllListeners();
        callback();
      };

      const fail = (error: unknown) => {
        finish(() => {
          try {
            zipFile.close();
          } catch {
            // ignore close errors while bailing out
          }
          reject(error instanceof Error ? error : new Error(String(error)));
        });
      };

      zipFile.on('error', fail);
      zipFile.on('end', () => {
        finish(() => resolve(extractedFiles));
      });
      zipFile.on('entry', (entry) => {
        void this.handleEntry({
          zipFile,
          entry,
          extractDir,
          extractedFiles,
          onNext: () => zipFile.readEntry(),
          onFail: fail,
          updateCounters: (size) => {
            fileCount += 1;
            totalSize += size;
            if (fileCount > MAX_ZIP_FILE_COUNT) {
              throw new BadRequestException(`压缩包文件数量超过限制（最多 ${MAX_ZIP_FILE_COUNT} 个）`);
            }
            if (size > MAX_ZIP_SINGLE_FILE_BYTES) {
              throw new BadRequestException(
                `压缩包内存在超过限制的大文件（单文件最大 ${Math.round(MAX_ZIP_SINGLE_FILE_BYTES / 1024 / 1024)}MB）`,
              );
            }
            if (totalSize > MAX_ZIP_TOTAL_UNCOMPRESSED_BYTES) {
              throw new BadRequestException(
                `压缩包解压后总大小超过限制（最大 ${Math.round(MAX_ZIP_TOTAL_UNCOMPRESSED_BYTES / 1024 / 1024)}MB）`,
              );
            }
          },
        });
      });

      zipFile.readEntry();
    });
  }

  private async handleEntry(params: {
    zipFile: yauzl.ZipFile;
    entry: yauzl.Entry;
    extractDir: string;
    extractedFiles: ExtractedZipFile[];
    onNext: () => void;
    onFail: (error: unknown) => void;
    updateCounters: (size: number) => void;
  }): Promise<void> {
    const { zipFile, entry, extractDir, extractedFiles, onNext, onFail, updateCounters } = params;

    try {
      const isDirectory = /\/$/.test(entry.fileName);
      const relativePath = this.normalizeEntryPath(entry.fileName, isDirectory);
      const outputPath = path.join(extractDir, ...relativePath.split('/'));

      if (isDirectory) {
        await mkdir(outputPath, { recursive: true });
        onNext();
        return;
      }

      updateCounters(entry.uncompressedSize);
      await mkdir(path.dirname(outputPath), { recursive: true });
      await this.extractFileEntry(zipFile, entry, outputPath);
      extractedFiles.push({
        absolutePath: outputPath,
        relativePath,
        size: entry.uncompressedSize,
      });
      onNext();
    } catch (error) {
      onFail(error);
    }
  }

  private normalizeEntryPath(fileName: string, isDirectory: boolean): string {
    const raw = fileName.replace(/\\/g, '/');
    if (!raw || raw.startsWith('/')) {
      throw new BadRequestException('压缩包包含非法绝对路径');
    }
    if (/^[a-zA-Z]:/.test(raw)) {
      throw new BadRequestException('压缩包包含非法 Windows 盘符路径');
    }

    const normalized = path.posix.normalize(raw);
    if (
      normalized === '.' ||
      normalized === '' ||
      normalized === '..' ||
      normalized.startsWith('../') ||
      normalized.includes('/../')
    ) {
      throw new BadRequestException('压缩包包含非法路径穿越内容');
    }

    const segments = normalized.split('/').filter(Boolean);
    const directoryDepth = Math.max(segments.length - (isDirectory ? 0 : 1), 0);
    if (directoryDepth > MAX_ZIP_DIRECTORY_DEPTH) {
      throw new BadRequestException(
        `压缩包目录层级超过限制（最多 ${MAX_ZIP_DIRECTORY_DEPTH} 层）`,
      );
    }

    if (!isDirectory) {
      const ext = path.extname(normalized).slice(1).toLowerCase();
      if (!ext || !LCC_ZIP_ALLOWED_EXTENSIONS.has(ext)) {
        throw new BadRequestException(`压缩包包含不允许的文件类型：.${ext || '(无扩展名)'}`);
      }
    }

    return segments.join('/');
  }

  private async extractFileEntry(
    zipFile: yauzl.ZipFile,
    entry: yauzl.Entry,
    outputPath: string,
  ): Promise<void> {
    const readStream = await new Promise<Readable>((resolve, reject) => {
      zipFile.openReadStream(entry, (error, stream) => {
        if (error || !stream) {
          reject(error ?? new Error(`无法读取 ZIP 条目：${entry.fileName}`));
          return;
        }
        resolve(stream);
      });
    });

    await pipeline(readStream, createWriteStream(outputPath));
  }

  private openZip(zipPath: string): Promise<yauzl.ZipFile> {
    return new Promise<yauzl.ZipFile>((resolve, reject) => {
      yauzl.open(
        zipPath,
        {
          lazyEntries: true,
          validateEntrySizes: true,
        },
        (error, zipFile) => {
          if (error || !zipFile) {
            reject(error ?? new Error('无法打开 ZIP 文件'));
            return;
          }
          resolve(zipFile);
        },
      );
    });
  }
}
