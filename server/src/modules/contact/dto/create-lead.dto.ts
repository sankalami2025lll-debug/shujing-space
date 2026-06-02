/**
 * DTO：提交联系线索入参
 * 接口：POST /api/contact/leads（游客可提交，无需登录）
 * 字段（对应 ContactPage.tsx 表单 + contact_leads 表）：
 *  - name：姓名（必填，≤60，对应 contact_leads.name）
 *  - contactWay：手机/微信（必填，≤120，对应 contact_leads.contact_way）
 *  - company：公司名称（可选，≤120）
 *  - email：联系邮箱（可选；若填写必须为合法邮箱，≤120）
 *  - scene：业务场景（可选，≤40）
 *  - dataTypes：所需数据类型（可选，字符串数组，每项 ≤40，以 Json 数组入库）
 *  - stage：项目阶段（可选，≤40）
 *  - budget：预算范围（可选，≤40）
 *  - message：项目需求描述（可选，≤2000）
 * 说明：
 *  - status 不接收前端入参，后端固定写 LeadStatus.new。
 *  - 长度上限与 schema.prisma 中 contact_leads 各字段 VarChar 长度对齐。
 */
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateLeadDto {
  // 姓名（必填）
  @ApiProperty({ description: '姓名', example: '张三' })
  @IsString({ message: 'name 必须为字符串' })
  @IsNotEmpty({ message: 'name 不能为空' })
  @MaxLength(60, { message: 'name 长度不能超过 60' })
  name!: string;

  // 手机 / 微信（必填）
  @ApiProperty({ description: '手机 / 微信', example: '13800000000' })
  @IsString({ message: 'contactWay 必须为字符串' })
  @IsNotEmpty({ message: 'contactWay 不能为空' })
  @MaxLength(120, { message: 'contactWay 长度不能超过 120' })
  contactWay!: string;

  // 公司名称（可选）
  @ApiPropertyOptional({ description: '公司名称' })
  @IsOptional()
  @IsString({ message: 'company 必须为字符串' })
  @MaxLength(120, { message: 'company 长度不能超过 120' })
  company?: string;

  // 联系邮箱（可选；填写则必须为合法邮箱）
  @ApiPropertyOptional({ description: '联系邮箱（可选，填写则需合法）' })
  @IsOptional()
  @IsEmail({}, { message: 'email 必须为合法邮箱' })
  @MaxLength(120, { message: 'email 长度不能超过 120' })
  email?: string;

  // 业务场景（可选）
  @ApiPropertyOptional({ description: '业务场景' })
  @IsOptional()
  @IsString({ message: 'scene 必须为字符串' })
  @MaxLength(40, { message: 'scene 长度不能超过 40' })
  scene?: string;

  // 所需数据类型（可选，多选；以 Json 数组入库）
  @ApiPropertyOptional({ description: '所需数据类型（多选）', type: [String] })
  @IsOptional()
  @IsArray({ message: 'dataTypes 必须为数组' })
  @ArrayMaxSize(20, { message: 'dataTypes 数量不能超过 20' })
  @IsString({ each: true, message: 'dataTypes 每一项必须为字符串' })
  @MaxLength(40, { each: true, message: 'dataTypes 每一项长度不能超过 40' })
  dataTypes?: string[];

  // 项目阶段（可选）
  @ApiPropertyOptional({ description: '项目阶段' })
  @IsOptional()
  @IsString({ message: 'stage 必须为字符串' })
  @MaxLength(40, { message: 'stage 长度不能超过 40' })
  stage?: string;

  // 预算范围（可选）
  @ApiPropertyOptional({ description: '预算范围' })
  @IsOptional()
  @IsString({ message: 'budget 必须为字符串' })
  @MaxLength(40, { message: 'budget 长度不能超过 40' })
  budget?: string;

  // 项目需求描述（可选，最大 2000）
  @ApiPropertyOptional({ description: '项目需求描述', maxLength: 2000 })
  @IsOptional()
  @IsString({ message: 'message 必须为字符串' })
  @MaxLength(2000, { message: 'message 长度不能超过 2000' })
  message?: string;
}
