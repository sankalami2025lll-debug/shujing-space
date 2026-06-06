"use client";

import type { ModelDetail, ViewerType } from "@/lib/types";

export type ModelViewerKind =
  | "lcc"
  | "glb"
  | "ply"
  | "bim"
  | "osgb"
  | "iframe"
  | "zip"
  | "unsupported";

type ModelViewerInput = Pick<ModelDetail, "viewerType" | "fileFormat" | "viewerUrl">;

function normalizeValue(value?: string | null) {
  return value?.trim().toLowerCase() ?? "";
}

export function getUrlPathname(url?: string | null) {
  if (!url) return "";
  try {
    return new URL(
      url,
      typeof window !== "undefined" ? window.location.href : "http://localhost",
    ).pathname.toLowerCase();
  } catch {
    return url.split(/[?#]/)[0]?.toLowerCase() ?? "";
  }
}

export function getUrlExtension(url?: string | null) {
  const pathname = getUrlPathname(url);
  const match = pathname.match(/\.([a-z0-9]+)$/i);
  return match?.[1]?.toLowerCase() ?? "";
}

function isLccViewerType(viewerType?: ViewerType | null) {
  return normalizeValue(viewerType) === "lcc";
}

function isLccFormat(fileFormat?: string | null, url?: string | null) {
  const normalizedFormat = normalizeValue(fileFormat);
  const extension = getUrlExtension(url);
  return (
    normalizedFormat === "lcc" ||
    normalizedFormat === "lcc2" ||
    extension === "lcc" ||
    extension === "lcc2"
  );
}

function isGlbFormat(fileFormat?: string | null, url?: string | null) {
  const normalizedFormat = normalizeValue(fileFormat);
  const extension = getUrlExtension(url);
  return (
    normalizedFormat === "glb" ||
    normalizedFormat === "gltf" ||
    extension === "glb" ||
    extension === "gltf"
  );
}

function isPlyFormat(fileFormat?: string | null, url?: string | null) {
  const normalizedFormat = normalizeValue(fileFormat);
  const extension = getUrlExtension(url);
  return normalizedFormat === "ply" || extension === "ply";
}

function isBimFormat(fileFormat?: string | null) {
  const normalizedFormat = normalizeValue(fileFormat);
  return normalizedFormat === "ifc" || normalizedFormat === "rvt";
}

function isOsgbFormat(fileFormat?: string | null, url?: string | null) {
  const normalizedFormat = normalizeValue(fileFormat);
  const extension = getUrlExtension(url);
  return normalizedFormat === "osgb" || extension === "osgb";
}

function isNativeEntryExtension(url?: string | null) {
  const extension = getUrlExtension(url);
  return ["lcc", "lcc2", "glb", "gltf", "ply", "ifc", "rvt", "osgb"].includes(extension);
}

export function isLccModel(detail: ModelViewerInput) {
  return isLccViewerType(detail.viewerType) || isLccFormat(detail.fileFormat, detail.viewerUrl);
}

export function getModelViewerKind(detail: ModelViewerInput): ModelViewerKind {
  const viewerType = normalizeValue(detail.viewerType);
  const fileFormat = normalizeValue(detail.fileFormat);

  if (isLccModel(detail)) {
    return "lcc";
  }

  if (isGlbFormat(detail.fileFormat, detail.viewerUrl)) {
    return "glb";
  }

  if (isPlyFormat(detail.fileFormat, detail.viewerUrl)) {
    return "ply";
  }

  if (isBimFormat(detail.fileFormat)) {
    return "bim";
  }

  if (isOsgbFormat(detail.fileFormat, detail.viewerUrl)) {
    return "osgb";
  }

  if (fileFormat === "zip") {
    return "zip";
  }

  // iframe 外链只承接非原生入口链接，避免 native/iframe 配置误入具体引擎。
  if ((viewerType === "iframe" || viewerType === "sketchfab") && !isNativeEntryExtension(detail.viewerUrl)) {
    return "iframe";
  }

  return "unsupported";
}
