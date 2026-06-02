/**
 * 视图模型 / 映射：联系线索接口对外字段
 * 用途：把 Prisma ContactLead 实体裁剪为提交回执视图，统一 BigInt（id）转 number。
 * 约定：
 *  - 提交回执只回 id / status / createdAt，不回显全部敏感字段（姓名/联系方式等）。
 */
import { ContactLead } from '@prisma/client';

// POST /api/contact/leads 提交回执
export interface LeadReceiptVm {
  id: number; // 线索主键
  status: string; // 线索状态（固定 new）
  createdAt: Date; // 提交时间
}

// 实体 → 提交回执视图
export function toLeadReceiptVm(lead: ContactLead): LeadReceiptVm {
  return {
    id: Number(lead.id),
    status: lead.status,
    createdAt: lead.createdAt,
  };
}
