/**
 * 模块：模型库列表常量
 * 用途：分类降级、排序映射、分页大小、发布弹窗选项（与 Vite ModelLibrary.tsx 一致）
 */
import type { ModelSort } from "@/lib/api/models";
import type { ModelVisibility } from "@/lib/types";

// MODEL_TYPES：分类接口失败时的降级静态分类（首项「全部模型」表示不过滤）
export const MODEL_TYPES = [
  "全部模型",
  "实景三维",
  "BIM 模型",
  "构件级模型",
  "具身智能机器人训练场景",
] as const;

export const SORT_OPTIONS = ["最新发布", "热门浏览", "最多收藏", "推荐模型"] as const;

// SORT_MAP：排序中文按钮 → 后端 sort 枚举
export const SORT_MAP: Record<string, ModelSort> = {
  最新发布: "latest",
  热门浏览: "views",
  最多收藏: "favorites",
  推荐模型: "recommended",
};

// PAGE_SIZE：列表每页条数，对应 GET /api/models?pageSize
export const PAGE_SIZE = 12;

// SCENE_OPTIONS：发布模型弹窗中的应用场景多选项，对应 models.scenes
export const SCENE_OPTIONS = [
  "数字文旅",
  "工程改造",
  "数字运维",
  "数字存档",
  "云上营销",
  "游戏影视",
  "数字孪生",
  "具身智能机器人训练",
] as const;

// VISIBILITY_OPTIONS：发布模型时的发布权限单选项，对应 models.visibility
export const VISIBILITY_OPTIONS = ["公开发布", "仅自己可见", "审核后公开"] as const;

// VISIBILITY_MAP：发布权限中文 → 后端 ModelVisibility 枚举（POST /api/models）
export const VISIBILITY_MAP: Record<string, ModelVisibility> = {
  公开发布: "public",
  仅自己可见: "private",
  审核后公开: "review",
};

// ROBOT_TYPES：训练数据申请弹窗中的机器人类型下拉项，对应 training_applications.robot_type
export const ROBOT_TYPES = [
  "巡检机器人",
  "服务机器人",
  "清洁机器人",
  "配送机器人",
  "工业机器人",
  "其他",
] as const;

// TRAIN_TASKS：训练数据申请弹窗中的训练任务多选项，对应 training_applications.train_tasks
export const TRAIN_TASKS = [
  "导航",
  "避障",
  "巡检",
  "目标识别",
  "空间交互",
  "任务理解",
  "路径规划",
] as const;
