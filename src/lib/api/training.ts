/**
 * 模块：训练数据服务申请接口封装 api/training.ts
 * 用途：封装具身智能机器人训练数据服务申请的「提交」接口，供 ModelLibrary 内的 TrainingModal 调用；统一基于 http.ts。
 * 对应后端：TrainingModule（server/src/modules/training）
 *   - POST /api/training-applications  提交训练数据服务申请（OptionalJwtAuthGuard：游客/登录均可）
 * 说明：
 *   - auth 默认 true：登录态自动带 Bearer，后端据此回填 userId（该申请将出现在个人中心「我的申请」）；
 *     游客无 token 提交合法，userId 为 null，不会归属任何用户。
 *   - 仅服务「具身智能机器人训练场景」，不扩展其它服务类型。
 * 备注：GET /api/training-applications/my 与个人中心「我的申请」口径一致，已由 api/users.ts 的 getMyApplications 覆盖，本文件不再重复封装。
 */
import { http } from "../http";
import type { ApplicationReceipt, CreateTrainingApplicationPayload } from "../types";

// createTrainingApplication：提交训练数据服务申请。
//   入参对齐后端 CreateTrainingApplicationDto：contactName/contactWay/company/robotType/sceneDesc 必填，trainTasks 可选。
//   返回回执 { id, status, createdAt }（status 由后端固定为 submitted）。
export function createTrainingApplication(
  payload: CreateTrainingApplicationPayload,
): Promise<ApplicationReceipt> {
  return http.post<ApplicationReceipt>("/training-applications", payload);
}
