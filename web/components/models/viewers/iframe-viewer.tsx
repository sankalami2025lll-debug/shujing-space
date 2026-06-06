"use client";

import { forwardRef, useImperativeHandle, useState } from "react";
import { ModelLoadingOverlay } from "@/components/models/model-loading-overlay";
import type { ModelViewerEngineProps, ModelViewerHandle } from "@/components/models/viewers/types";

export const IframeViewer = forwardRef<ModelViewerHandle, ModelViewerEngineProps>(
  function IframeViewer({ model }, ref) {
    const [iframeState, setIframeState] = useState<"loading" | "ready" | "error">("loading");
    const [viewKey, setViewKey] = useState(0);

    useImperativeHandle(
      ref,
      () => ({
        enterFullscreen: () => {
          // 第一阶段全屏由 Shell 外壳接管，这里仅预留统一句柄。
        },
      }),
      [],
    );

    return (
      <div className="absolute inset-0 overflow-hidden bg-[#0d0d0d]">
        <iframe
          key={viewKey}
          title={`${model.title} 三维在线查看器`}
          src={model.viewerUrl as string}
          loading="lazy"
          allow="autoplay; fullscreen; xr-spatial-tracking"
          allowFullScreen
          sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
          onLoad={() => setIframeState("ready")}
          onError={() => setIframeState("error")}
          className="absolute inset-0 h-full w-full border-0 bg-[#0d0d0d]"
        />

        <ModelLoadingOverlay
          visible={iframeState !== "ready"}
          status={iframeState === "error" ? "error" : "loading"}
          title={iframeState === "error" ? "模型加载失败" : "模型加载中"}
          description={iframeState === "error" ? "请刷新后重试" : "正在载入三维场景"}
          onRetry={
            iframeState === "error"
              ? () => {
                  setIframeState("loading");
                  setViewKey((value) => value + 1);
                }
              : undefined
          }
        />
      </div>
    );
  },
);
