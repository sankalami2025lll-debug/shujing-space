/**
 * 常量：联系我们表单选项配置
 * 用途：作为 GET /api/contact/options 的数据源，逐字对齐前端 ContactPage.tsx 写死的下拉/标签选项。
 * 说明：
 *  - scenes：业务场景下拉（单选）
 *  - dataTypes：所需数据类型（多选标签）
 *  - stages：项目阶段（单选标签）
 *  - budgets：预算范围下拉（单选）
 * 演进：本阶段以后端常量落地，保证「单一数据源」；二期可迁至 site_configs 由后台维护。
 */

// 业务场景（对应 ContactPage「业务场景」下拉）
export const CONTACT_SCENES = [
  '工程改造',
  '数字文旅',
  '游戏影视',
  '数字存档',
  '云上营销',
  '数字运维',
  '具身智能空间训练',
  '数字孪生',
  '其他',
] as const;

// 所需数据类型（对应 ContactPage「所需数据类型」多选标签）
export const CONTACT_DATA_TYPES = [
  '实景三维',
  'BIM 模型',
  '构件级模型',
  '具身智能空间训练场景模型',
  '云端模型展示',
  '数字孪生平台接入',
  '其他',
] as const;

// 项目阶段（对应 ContactPage「项目阶段」单选标签）
export const CONTACT_STAGES = [
  '前期咨询',
  '已有项目需求',
  '已有模型数据',
  '需要定制采集与建模',
  '需要平台接入',
  '其他',
] as const;

// 预算范围（对应 ContactPage「预算范围」下拉）
export const CONTACT_BUDGETS = [
  '暂不确定',
  '1万以内',
  '1万-5万',
  '5万-10万',
  '10万以上',
  '定制沟通',
] as const;

// GET /api/contact/options 返回结构
export interface ContactOptions {
  scenes: string[]; // 业务场景
  dataTypes: string[]; // 所需数据类型
  stages: string[]; // 项目阶段
  budgets: string[]; // 预算范围
}
