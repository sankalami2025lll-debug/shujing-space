"use client";

import { forwardRef } from "react";
import { ViewerPlaceholder } from "@/components/models/viewers/viewer-placeholder";
import type { ModelViewerEngineProps, ModelViewerHandle } from "@/components/models/viewers/types";

export const GlbViewer = forwardRef<ModelViewerHandle, ModelViewerEngineProps>(function GlbViewer(
  { model },
  _ref,
) {
  return (
    <ViewerPlaceholder
      formatLabel={model.fileFormat ?? "glb"}
      title="GLB / GLTF 在线预览引擎接入中"
      description="当前格式为 GLB / GLTF，该格式在线预览引擎正在接入中，第一阶段先保留统一壳子与接口位置。"
    />
  );
});
