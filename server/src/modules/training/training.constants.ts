/**
 * 常量：训练数据服务申请表单选项
 * 用途：作为申请字段校验/对外选项的数据源，逐字对齐前端 ModelLibrary.tsx 的 TrainingModal。
 * 红线：本弹窗只服务「具身智能机器人训练场景」，不扩展其它服务类型。
 * 说明：
 *  - ROBOT_TYPES：机器人类型下拉（单选），对应 robot_type 字段。
 *  - TRAIN_TASKS：训练任务多选标签，对应 train_tasks（Json 数组）字段。
 */

// 机器人类型（对应 TrainingModal「机器人类型」下拉）
export const ROBOT_TYPES = [
  '巡检机器人',
  '服务机器人',
  '清洁机器人',
  '配送机器人',
  '工业机器人',
  '其他',
] as const;

// 训练任务（对应 TrainingModal「训练任务」多选标签）
export const TRAIN_TASKS = [
  '导航',
  '避障',
  '巡检',
  '目标识别',
  '空间交互',
  '任务理解',
  '路径规划',
] as const;
