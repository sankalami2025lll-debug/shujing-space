"use client";

import { useMemo, useRef, useState } from "react";
import { ModelViewerToolbar } from "@/components/models/model-viewer-toolbar";
import { BimViewer } from "@/components/models/viewers/bim-viewer";
import { GlbViewer } from "@/components/models/viewers/glb-viewer";
import { IframeViewer } from "@/components/models/viewers/iframe-viewer";
import { LccViewer } from "@/components/models/lcc-viewer";
import { OsgbViewer } from "@/components/models/viewers/osgb-viewer";
import { PlyViewer } from "@/components/models/viewers/ply-viewer";
import { UnsupportedViewer } from "@/components/models/viewers/unsupported-viewer";
import {
  getViewerCapabilities,
  type ModelViewerHandle,
} from "@/components/models/viewers/types";
import { getModelViewerKind } from "@/lib/model-viewer-kind";
import type { ModelDetail } from "@/lib/types";

interface ModelViewerShellProps {
  model: ModelDetail;
}

function processingStatusText(status: ModelDetail["processingStatus"]) {
  switch (status) {
    case "uploaded":
      return "模型文件已上传，正在等待进入后台解析。";
    case "processing":
      return "模型正在后台解析中，完成后即可在线浏览。";
    case "failed":
      return "模型解析失败，请联系管理员或稍后重新发布。";
    case "ready":
    default:
      return "";
  }
}

export function ModelViewerShell({ model }: ModelViewerShellProps) {
  const viewerViewportRef = useRef<HTMLDivElement | null>(null);
  const viewerHandleRef = useRef<ModelViewerHandle | null>(null);
  const [viewerResetSeed, setViewerResetSeed] = useState(0);
  const viewerKind = getModelViewerKind(model);
  const processingBlocked = model.processingStatus !== "ready";
  const processingHint = processingStatusText(model.processingStatus);
  const viewerCapabilities = useMemo(() => getViewerCapabilities(viewerKind), [viewerKind]);

  const handleFullscreen = () => {
    const element = viewerViewportRef.current;
    if (!element) return;

    if (document.fullscreenElement === element) {
      document.exitFullscreen().catch(() => {});
      return;
    }

    if (!document.fullscreenElement) {
      element.requestFullscreen().catch(() => {});
      return;
    }

    element.requestFullscreen().catch(() => {});
  };

  const handleResetView = () => {
    if (viewerCapabilities.resetView) {
      if (viewerHandleRef.current?.resetView) {
        viewerHandleRef.current.resetView();
        return;
      }

      if (viewerHandleRef.current?.fitView) {
        viewerHandleRef.current.fitView();
        return;
      }
    }

    if (viewerKind === "lcc") {
      // LCC reset 的第一版仍允许用重挂载兜底，避免外壳按钮失效。
      setViewerResetSeed((value) => value + 1);
      return;
    }
  };

  const handleTakeScreenshot = () => {
    void viewerHandleRef.current?.takeScreenshot?.();
  };

  const renderViewer = () => {
    switch (viewerKind) {
      case "lcc":
        return (
          <LccViewer
            key={viewerResetSeed}
            ref={viewerHandleRef}
            modelUrl={model.viewerUrl}
            viewerUrl={model.viewerUrl}
            fileFormat={model.fileFormat}
            viewerType={model.viewerType}
            processingBlocked={processingBlocked}
            processingHint={processingHint}
          />
        );
      case "glb":
        return <GlbViewer ref={viewerHandleRef} model={model} processingHint={processingHint} />;
      case "ply":
        return <PlyViewer ref={viewerHandleRef} model={model} processingHint={processingHint} />;
      case "bim":
        return <BimViewer ref={viewerHandleRef} model={model} processingHint={processingHint} />;
      case "osgb":
        return <OsgbViewer ref={viewerHandleRef} model={model} processingHint={processingHint} />;
      case "iframe":
        return (
          <IframeViewer
            key={viewerResetSeed}
            ref={viewerHandleRef}
            model={model}
            processingHint={processingHint}
          />
        );
      case "zip":
      case "unsupported":
      default:
        return (
          <UnsupportedViewer
            ref={viewerHandleRef}
            model={model}
            processingHint={processingHint}
          />
        );
    }
  };

  return (
    <div className="flex h-full flex-col bg-[#0d0d0d]">
      <div ref={viewerViewportRef} className="relative min-h-[520px] flex-1 overflow-hidden">
        {renderViewer()}
        <div className="pointer-events-none absolute bottom-4 left-4 z-20">
          <div className="pointer-events-auto">
            <ModelViewerToolbar
              capabilities={viewerCapabilities}
              onResetView={handleResetView}
              onToggleFullscreen={handleFullscreen}
              onTakeScreenshot={handleTakeScreenshot}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
