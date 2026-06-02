/**
 * 模块：联系我们接口封装 api/contact.ts
 * 用途：封装联系我们表单的「选项配置」与「线索提交」两个公开接口，供 ContactPage 调用；统一基于 http.ts。
 * 对应后端：ContactModule（server/src/modules/contact）
 *   - GET  /api/contact/options  获取表单选项（业务场景/数据类型/项目阶段/预算）
 *   - POST /api/contact/leads    提交客户咨询线索（游客可提交，status 由后端固定为 new）
 * 说明：两个接口均为公开接口，用 auth:false 不携带 token（带上也无副作用）。
 */
import { http } from "../http";
import type { ContactOptions, CreateLeadPayload, LeadReceipt } from "../types";

// getContactOptions：获取联系表单选项配置（公开接口）。失败时由调用方回退本地写死选项。
export function getContactOptions(): Promise<ContactOptions> {
  return http.get<ContactOptions>("/contact/options", { auth: false });
}

// createLead：提交客户咨询线索（公开接口，游客/登录用户一致）。
export function createLead(payload: CreateLeadPayload): Promise<LeadReceipt> {
  return http.post<LeadReceipt>("/contact/leads", payload, { auth: false });
}
