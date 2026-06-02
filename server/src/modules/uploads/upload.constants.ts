/**
 * 常量：上传白名单与文件用途
 * 用途：定义各类文件（模型 / 封面 / 视频）允许的扩展名，供 presign 服务端二次校验。
 * 说明：
 *  - 模型文件 MIME 常为 application/octet-stream，难以可靠判断，故以「扩展名白名单 + 大小上限」为主校验依据。
 *  - 大小上限走环境变量（MAX_MODEL_SIZE_MB / MAX_COVER_SIZE_MB），见 config。
 */
import { FileKind } from '@prisma/client';

// 各文件用途允许的扩展名（小写，不含点）
export const ALLOWED_EXTENSIONS: Record<FileKind, string[]> = {
  // 模型文件：glb/gltf/ifc/点云(las,laz,ply)/3dtiles(常打包 zip 或 json tileset)
  model: ['glb', 'gltf', 'ifc', 'las', 'laz', 'ply', 'zip', 'json'],
  // 封面图：常见 web 图片格式
  cover: ['jpg', 'jpeg', 'png', 'webp'],
  // 视频：mp4/webm/mov
  video: ['mp4', 'webm', 'mov'],
};

// 从文件名安全地取小写扩展名（无扩展名返回空串）
export function extractExtension(fileName: string): string {
  const base = fileName.split(/[\\/]/).pop() ?? fileName; // 去掉任何路径片段，防穿越
  const dot = base.lastIndexOf('.');
  if (dot < 0 || dot === base.length - 1) return '';
  return base.slice(dot + 1).toLowerCase();
}

// 各用途允许的 Content-Type（HeadObject 复核用；去掉 parameters 后小写比对）
export const ALLOWED_MIMES: Record<FileKind, string[]> = {
  model: [
    'application/octet-stream',
    'binary/octet-stream',
    'model/gltf+json',
    'model/gltf-binary',
    'application/gltf-buffer',
    'application/json',
    'application/zip',
    'application/x-zip-compressed',
    'text/plain',
  ],
  cover: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
  video: ['video/mp4', 'video/webm', 'video/quicktime'],
};

// normalizeMime：去掉 charset 等参数并转小写（如 image/jpeg; charset=utf-8 → image/jpeg）
export function normalizeMime(mime: string): string {
  return mime.split(';')[0]?.trim().toLowerCase() ?? '';
}

// isMimeAllowed：判断 HeadObject 返回的 Content-Type 是否允许登记
export function isMimeAllowed(kind: FileKind, mime: string): boolean {
  const normalized = normalizeMime(mime);
  if (!normalized) return false;
  return ALLOWED_MIMES[kind].includes(normalized);
}
