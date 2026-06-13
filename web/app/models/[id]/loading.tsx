"use client";

import { ModelLoadingOverlay } from "@/components/models/model-loading-overlay";

export default function ModelDetailRouteLoading() {
  return (
    <div className="relative min-h-[calc(100vh-4rem)] bg-[#0a0a0a] md:min-h-[calc(100vh-72px)]">
      <ModelLoadingOverlay visible showText={false} />
    </div>
  );
}
