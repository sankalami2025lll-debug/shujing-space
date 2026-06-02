/**
 * DTO：提交训练数据服务申请入参
 * 接口：POST /api/training-applications（游客/用户均可提交）
 * 字段（对应 ModelLibrary.tsx 的 TrainingModal + training_applications 表）：
 *  - contactName：联系人（必填，≤60，对应 contact_name）
 *  - contactWay：手机/微信（必填，≤120，对应 contact_way）
 *  - company：公司名称（必填，≤120，表定义非空）
 *  - robotType：机器人类型（必填，≤40，对应 robot_type）
 *  - trainTasks：训练任务（可选，字符串数组，每项 ≤40，以 Json 数组入库）
 *  - sceneDesc：场景需求描述（必填，≤2000，对应 scene_desc）
 * 红线：
 *  - 本申请只服务「具身智能机器人训练场景」，DTO 不含 serviceType 等扩展字段。
 *  - status 不接收前端入参，后端固定写 TrainingStatus.submitted。
 *  - userId 不接收前端入参，由登录态自动回填（游客为 null）。
 *  - 长度上限与 schema.prisma 中 training_applications 各字段 VarChar 长度对齐。
 */
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateTrainingApplicationDto {
  // 联系人（必填）
  @ApiProperty({ description: '联系人', example: '张三' })
  @IsString({ message: 'contactName 必须为字符串' })
  @IsNotEmpty({ message: 'contactName 不能为空' })
  @MaxLength(60, { message: 'contactName 长度不能超过 60' })
  contactName!: string;

  // 手机 / 微信（必填）
  @ApiProperty({ description: '手机 / 微信', example: '13800000000' })
  @IsString({ message: 'contactWay 必须为字符串' })
  @IsNotEmpty({ message: 'contactWay 不能为空' })
  @MaxLength(120, { message: 'contactWay 长度不能超过 120' })
  contactWay!: string;

  // 公司名称（必填，表定义非空）
  @ApiProperty({ description: '公司名称', example: '某机器人公司' })
  @IsString({ message: 'company 必须为字符串' })
  @IsNotEmpty({ message: 'company 不能为空' })
  @MaxLength(120, { message: 'company 长度不能超过 120' })
  company!: string;

  // 机器人类型（必填）
  @ApiProperty({ description: '机器人类型', example: '巡检机器人' })
  @IsString({ message: 'robotType 必须为字符串' })
  @IsNotEmpty({ message: 'robotType 不能为空' })
  @MaxLength(40, { message: 'robotType 长度不能超过 40' })
  robotType!: string;

  // 训练任务（可选，多选；以 Json 数组入库）
  @ApiPropertyOptional({ description: '训练任务（多选）', type: [String] })
  @IsOptional()
  @IsArray({ message: 'trainTasks 必须为数组' })
  @ArrayMaxSize(20, { message: 'trainTasks 数量不能超过 20' })
  @IsString({ each: true, message: 'trainTasks 每一项必须为字符串' })
  @MaxLength(40, { each: true, message: 'trainTasks 每一项长度不能超过 40' })
  trainTasks?: string[];

  // 场景需求描述（必填，最大 2000）
  @ApiProperty({ description: '场景需求描述', maxLength: 2000 })
  @IsString({ message: 'sceneDesc 必须为字符串' })
  @IsNotEmpty({ message: 'sceneDesc 不能为空' })
  @MaxLength(2000, { message: 'sceneDesc 长度不能超过 2000' })
  sceneDesc!: string;
}
