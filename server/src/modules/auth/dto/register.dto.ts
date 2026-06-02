/**
 * DTO：注册入参
 * 接口：POST /api/auth/register
 * 字段：
 *  - account：手机号或邮箱（必填，唯一）
 *  - code：注册验证码（必填，对应 scene=register）
 *  - password：登录密码（必填，≥6 位）
 *  - company：公司名称（可选）
 *  - roleType：角色 / 需求类型（可选，注册表单）
 *  - agreed：是否同意用户协议与隐私政策（必填且必须为 true）
 */
import { ApiProperty } from '@nestjs/swagger';
import {
  Equals,
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  // 账号：手机号或邮箱
  @ApiProperty({ description: '手机号或邮箱', example: '13800000000' })
  @IsString({ message: 'account 必须为字符串' })
  @IsNotEmpty({ message: 'account 不能为空' })
  @MaxLength(120, { message: 'account 长度不能超过 120' })
  account!: string;

  // 注册验证码
  @ApiProperty({ description: '注册验证码', example: '123456' })
  @IsString({ message: 'code 必须为字符串' })
  @IsNotEmpty({ message: 'code 不能为空' })
  code!: string;

  // 登录密码（≥6 位）
  @ApiProperty({ description: '登录密码（≥6 位）', minLength: 6 })
  @IsString({ message: 'password 必须为字符串' })
  @MinLength(6, { message: 'password 至少 6 位' })
  @MaxLength(64, { message: 'password 长度不能超过 64' })
  password!: string;

  // 公司名称（可选）
  @ApiProperty({ description: '公司名称', required: false })
  @IsOptional()
  @IsString({ message: 'company 必须为字符串' })
  @MaxLength(120, { message: 'company 长度不能超过 120' })
  company?: string;

  // 角色 / 需求类型（可选）
  @ApiProperty({ description: '角色 / 需求类型', required: false })
  @IsOptional()
  @IsString({ message: 'roleType 必须为字符串' })
  @MaxLength(40, { message: 'roleType 长度不能超过 40' })
  roleType?: string;

  // 协议勾选：必须为 true 才允许注册（对应前端未勾选禁止注册）
  @ApiProperty({ description: '是否同意用户协议与隐私政策', example: true })
  @IsBoolean({ message: 'agreed 必须为布尔值' })
  @Equals(true, { message: '请先同意用户协议与隐私政策' })
  agreed!: boolean;
}
