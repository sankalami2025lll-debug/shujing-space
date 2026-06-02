/**
 * 模块：训练数据服务申请接口封装 api/training.ts
 * 用途：封装具身智能机器人训练数据服务申请的「提交」接口，供 TrainingModal 调用；统一基于 http.ts。
 * 对应后端：TrainingModule（POST /api/training-applications，OptionalJwtAuthGuard：游客/登录均可）
 * 说明：auth 默认 true——有 token 时自动带 Bearer，后端回填 userId；游客无 token 亦可提交。
 */
import { http } from "../http";
import type { ApplicationReceipt, CreateTrainingApplicationPayload } from "../types";

// createTrainingApplication：提交训练数据服务申请，返回 { id, status, createdAt }
export function createTrainingApplication(
  payload: CreateTrainingApplicationPayload,
): Promise<ApplicationReceipt> {
  return http.post<ApplicationReceipt>("/training-applications", payload);
}
