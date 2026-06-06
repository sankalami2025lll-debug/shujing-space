"use client";

import { forwardRef } from "react";
import { ModelErrorState } from "@/components/models/model-error-state";
import { ViewerPlaceholder } from "@/components/models/viewers/viewer-placeholder";
import type { ModelViewerEngineProps, ModelViewerHandle } from "@/components/models/viewers/types";

export const UnsupportedViewer = forwardRef<ModelViewerHandle, ModelViewerEngineProps>(
  function UnsupportedViewer({ model }, _ref) {
    const fileFormat = model.fileFormat?.trim().toLowerCase() ?? "";

    if (fileFormat === "zip") {
      return (
        <ViewerPlaceholder
          formatLabel="zip"
          title="ZIP 成果包暂不可直接在线预览"
          description="如果这是 LCC 成果 ZIP，请等待后台处理完成；处理成功后 fileFormat 会切换为 lcc 或 lcc2。"
        />
      );
    }

    return (
      <div className="absolute inset-0 overflow-hidden bg-[radial-gradient(circle_at_top,rgba(45,212,191,0.14),transparent_32%),linear-gradient(135deg,#07111a_0%,#071826_45%,#04070c_100%)]">
        <ModelErrorState
          tone="warning"
          currentFormat={model.fileFormat ?? "unknown"}
          title="该格式在线预览引擎正在接入中"
          description="当前模型未命中已接入 Viewer，统一壳子已保留分发位置，后续可独立接入对应格式引擎。"
        />
      </div>
    );
  },
);
