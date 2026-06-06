"use client";

import type { ModelViewerKind } from "@/lib/model-viewer-kind";
import type { ModelDetail } from "@/lib/types";

export type ModelViewerHandle = {
  resetView?: () => void;
  fitView?: () => void;
  enterFullscreen?: () => void;
  takeScreenshot?: () => Promise<string | void> | string | void;
};

export type ModelViewerCapabilities = {
  resetView: boolean;
  zoom: boolean;
  pan: boolean;
  orbit: boolean;
  walk: boolean;
  measure: boolean;
  annotation: boolean;
  layer: boolean;
  section: boolean;
  screenshot: boolean;
  fullscreen: boolean;
};

export interface ModelViewerEngineProps {
  model: ModelDetail;
  processingHint?: string;
}

export const EMPTY_VIEWER_CAPABILITIES: ModelViewerCapabilities = {
  resetView: false,
  zoom: false,
  pan: false,
  orbit: false,
  walk: false,
  measure: false,
  annotation: false,
  layer: false,
  section: false,
  screenshot: false,
  fullscreen: false,
};

export const LCC_VIEWER_CAPABILITIES: ModelViewerCapabilities = {
  ...EMPTY_VIEWER_CAPABILITIES,
  resetView: true,
  zoom: true,
  pan: true,
  orbit: true,
  fullscreen: true,
};

export const IFRAME_VIEWER_CAPABILITIES: ModelViewerCapabilities = {
  ...EMPTY_VIEWER_CAPABILITIES,
  fullscreen: true,
};

export function getViewerCapabilities(kind: ModelViewerKind): ModelViewerCapabilities {
  switch (kind) {
    case "lcc":
      return LCC_VIEWER_CAPABILITIES;
    case "iframe":
      return IFRAME_VIEWER_CAPABILITIES;
    default:
      return EMPTY_VIEWER_CAPABILITIES;
  }
}
