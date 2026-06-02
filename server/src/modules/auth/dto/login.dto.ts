/**
 * DTO：登录入参
 * 接口：POST /api/auth/login
 * 字段：
 *  - account：手机号或邮箱（必填）
 *  - loginType：登录方式（password 密码 / code 验证码，默认 password）
 *  - password：密码（loginType=password 时必填，由 Service 二次校验）
 *  - code：验证码（loginType=code 时必填，由 Service 二次校验）
 */
import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export const LOGIN_TYPES = ['password', 'code'] as const;
export type LoginTypeValue = (typeof LOGIN_TYPES)[number];

export class LoginDto {
  // 账号：手机号或邮箱
  @ApiProperty({ description: '手机号或邮箱', example: '13800000000' })
  @IsString({ message: 'account 必须为字符串' })
  @IsNotEmpty({ message: 'account 不能为空' })
  @MaxLength(120, { message: 'account 长度不能超过 120' })
  account!: string;

  // 登录方式：password / code，默认 password
  @ApiProperty({ description: '登录方式', enum: LOGIN_TYPES, default: 'password' })
  @IsOptional()
  @IsIn(LOGIN_TYPES, { message: 'loginType 必须为 password/code 之一' })
  loginType: LoginTypeValue = 'password';

  // 密码（密码登录时必填）
  @ApiProperty({ description: '密码（密码登录时必填）', required: false })
  @IsOptional()
  @IsString({ message: 'password 必须为字符串' })
  @MaxLength(64, { message: 'password 长度不能超过 64' })
  password?: string;

  // 验证码（验证码登录时必填）
  @ApiProperty({ description: '验证码（验证码登录时必填）', required: false })
  @IsOptional()
  @IsString({ message: 'code 必须为字符串' })
  @MaxLength(10, { message: 'code 长度不能超过 10' })
  code?: string;
}
