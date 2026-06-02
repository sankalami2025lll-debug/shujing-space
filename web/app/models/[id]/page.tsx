/**
 * 页面名称：模型详情 ModelDetail
 * 页面用途：单模型三维浏览与信息展示路由 /models/[id]
 * 对应文档：页面功能注释文档/06_模型详情_ModelDetail.md
 */
import ModelDetailPage from "@/components/pages/model-detail-page";

interface ModelDetailRouteProps {
  params: Promise<{ id: string }>;
}

export default async function ModelDetailRoutePage({ params }: ModelDetailRouteProps) {
  const { id } = await params;
  return <ModelDetailPage modelId={id} />;
}
