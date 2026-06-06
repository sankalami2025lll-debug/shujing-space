"use client";

import { forwardRef } from "react";
import { ViewerPlaceholder } from "@/components/models/viewers/viewer-placeholder";
import type { ModelViewerEngineProps, ModelViewerHandle } from "@/components/models/viewers/types";

export const PlyViewer = forwardRef<ModelViewerHandle, ModelViewerEngineProps>(function PlyViewer(
  { model },
  _ref,
) {
  return (
    <ViewerPlaceholder
      formatLabel={model.fileFormat ?? "ply"}
      title="PLY 在线预览引擎接入中"
      description="当前格式为 PLY，该格式在线预览引擎正在接入中，后续可继续细分点云与 Gaussian Splatting 浏览实现。"
    />
  );
});
