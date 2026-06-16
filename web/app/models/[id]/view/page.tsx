/**
 * 页面名称：模型分享沉浸式观看页 ModelShareViewer
 * 页面用途：分享链接打开的纯模型沉浸式观看 /models/[id]/view
 */
import { notFound } from "next/navigation";
import ModelShareViewerPage from "@/components/pages/model-share-viewer-page";

interface ModelShareViewerRouteProps {
  params: Promise<{ id: string }>;
}

export default async function ModelShareViewerRoutePage({ params }: ModelShareViewerRouteProps) {
  const { id } = await params;

  const numericId = Number.parseInt(id, 10);
  if (!Number.isFinite(numericId) || numericId <= 0) {
    notFound();
  }

  return <ModelShareViewerPage modelId={id} />;
}
