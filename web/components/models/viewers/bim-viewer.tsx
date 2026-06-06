"use client";

import { forwardRef } from "react";
import { ViewerPlaceholder } from "@/components/models/viewers/viewer-placeholder";
import type { ModelViewerEngineProps, ModelViewerHandle } from "@/components/models/viewers/types";

export const BimViewer = forwardRef<ModelViewerHandle, ModelViewerEngineProps>(function BimViewer(
  { model },
  _ref,
) {
  return (
    <ViewerPlaceholder
      formatLabel={model.fileFormat ?? "bim"}
      title="BIM 在线预览引擎接入中"
      description="当前格式为 IFC / RVT 等 BIM 模型，该格式在线预览引擎正在接入中，第一阶段先预留独立 Viewer 接口。"
    />
  );
});
