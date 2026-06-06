"use client";

import { forwardRef } from "react";
import { ViewerPlaceholder } from "@/components/models/viewers/viewer-placeholder";
import type { ModelViewerEngineProps, ModelViewerHandle } from "@/components/models/viewers/types";

export const OsgbViewer = forwardRef<ModelViewerHandle, ModelViewerEngineProps>(function OsgbViewer(
  { model },
  _ref,
) {
  return (
    <ViewerPlaceholder
      formatLabel={model.fileFormat ?? "osgb"}
      title="OSGB 在线预览引擎接入中"
      description="当前格式为 OSGB，该格式在线预览引擎正在接入中，后续可独立对接 3D Tiles / Cesium 方案。"
    />
  );
});
