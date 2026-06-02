/**
 * 视图模型 / 映射：训练数据服务申请接口对外字段
 * 用途：
 *  - ApplicationReceiptVm：POST /api/training-applications 提交回执（仅 id/status/createdAt）。
 *  - 列表项口径：GET /api/training-applications/my 复用个人中心的 MyApplicationVm / toMyApplicationVm，
 *    保证与 GET /api/users/me/applications 字段、排序完全一致（同一映射函数，单一口径）。
 * 约定：BigInt（id）统一转 number。
 */
import { TrainingApplication } from '@prisma/client';

// 复用个人中心已有的申请列表 VM 与映射，确保两接口口径一致
export { MyApplicationVm, toMyApplicationVm } from '../users/users.vm';

// POST /api/training-applications 提交回执
export interface ApplicationReceiptVm {
  id: number; // 申请主键
  status: string; // 申请状态（固定 submitted）
  createdAt: Date; // 提交时间
}

// 实体 → 提交回执视图
export function toApplicationReceiptVm(
  app: TrainingApplication,
): ApplicationReceiptVm {
  return {
    id: Number(app.id),
    status: app.status,
    createdAt: app.createdAt,
  };
}
