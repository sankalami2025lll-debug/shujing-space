/**
 * 模块：文件上传接口封装 api/uploads.ts
 * 用途：封装 R2 直传流程（presign → 浏览器 PUT → callback），供 UploadModal 发布模型时上传模型/封面文件。
 * 对应后端：UploadsModule
 *   - POST /api/uploads/presign   申请预签名地址（需登录）
 *   - POST /api/uploads/callback  上传完成登记 model_files（需登录）
 * 红线：文件只存 Cloudflare R2，不经服务器本地；R2 未配置时 presign 返回 503，前端展示固定提示，不做本地兜底。
 */
import { http, ApiError } from "../http";
import type {
  FileKind,
  PresignResult,
  UploadCallbackResult,
} from "../types";

// R2_NOT_CONFIGURED_MESSAGE：R2 环境未配置时展示给用户的固定文案（产品要求，与后端 503 长文案区分）。
export const R2_NOT_CONFIGURED_MESSAGE =
  "R2 对象存储未配置，请先配置对象存储";

// PresignParams：申请预签名入参，对齐后端 PresignDto。
export interface PresignParams {
  kind: FileKind;
  fileName: string;
  mime: string;
  size: number;
}

// UploadCallbackParams：上传完成登记入参，对齐后端 UploadCallbackDto。
export interface UploadCallbackParams {
  kind: FileKind;
  r2Key: string;
  originalName: string;
  mime: string;
  size: number;
}

// presignUpload：申请 R2 预签名 PUT 地址；503 时映射为固定用户文案。
export function presignUpload(params: PresignParams): Promise<PresignResult> {
  return http
    .post<PresignResult>("/uploads/presign", params)
    .catch((e: unknown) => {
      if (e instanceof ApiError && e.status === 503) {
        throw new ApiError(R2_NOT_CONFIGURED_MESSAGE, e.code, e.status);
      }
      throw e;
    });
}

// uploadCallback：直传完成后登记 model_files，返回 fileId 供 POST /api/models 使用。
export function uploadCallback(
  params: UploadCallbackParams,
): Promise<UploadCallbackResult> {
  return http.post<UploadCallbackResult>("/uploads/callback", params);
}

/**
 * putFileToPresignedUrl：浏览器直传 R2（PUT presign.uploadUrl）。
 * 使用 presign 返回的 requiredHeaders（含 Content-Type），不走本站 /api 代理。
 */
export async function putFileToPresignedUrl(
  uploadUrl: string,
  file: File,
  requiredHeaders: Record<string, string>,
): Promise<void> {
  const headers = new Headers(requiredHeaders);
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", file.type || "application/octet-stream");
  }
  let res: Response;
  try {
    res = await fetch(uploadUrl, { method: "PUT", body: file, headers });
  } catch {
    throw new ApiError("文件上传到对象存储失败，请检查网络或稍后重试。", -1, 0);
  }
  if (!res.ok) {
    throw new ApiError(
      `文件上传到对象存储失败（HTTP ${res.status}）`,
      -1,
      res.status,
    );
  }
}

/**
 * uploadFileToR2：完整直传链路 presign → PUT → callback。
 * R2 未配置时在 presign 阶段抛 503 固定文案；不伪造成功、不落本地。
 */
export async function uploadFileToR2(
  kind: FileKind,
  file: File,
): Promise<UploadCallbackResult> {
  const mime = file.type || "application/octet-stream";
  const presign = await presignUpload({
    kind,
    fileName: file.name,
    mime,
    size: file.size,
  });
  await putFileToPresignedUrl(presign.uploadUrl, file, presign.requiredHeaders);
  return uploadCallback({
    kind,
    r2Key: presign.r2Key,
    originalName: file.name,
    mime,
    size: file.size,
  });
}
