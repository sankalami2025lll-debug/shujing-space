/**
 * DTO：找回 / 重置密码入参
 * 接口：POST /api/auth/reset-password
 * 字段：
 *  - account：手机号或邮箱（必填）
 *  - code：重置验证码（必填，对应 scene=reset）
 *  - newPassword：新密码（必填，≥6 位）
 */
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class ResetPasswordDto {
  // 账号：手机号或邮箱
  @ApiProperty({ description: '手机号或邮箱', example: '13800000000' })
  @IsString({ message: 'account 必须为字符串' })
  @IsNotEmpty({ message: 'account 不能为空' })
  @MaxLength(120, { message: 'account 长度不能超过 120' })
  account!: string;

  // 重置验证码
  @ApiProperty({ description: '重置验证码', example: '123456' })
  @IsString({ message: 'code 必须为字符串' })
  @IsNotEmpty({ message: 'code 不能为空' })
  code!: string;

  // 新密码（≥6 位）
  @ApiProperty({ description: '新密码（≥6 位）', minLength: 6 })
  @IsString({ message: 'newPassword 必须为字符串' })
  @MinLength(6, { message: 'newPassword 至少 6 位' })
  @MaxLength(64, { message: 'newPassword 长度不能超过 64' })
  newPassword!: string;
}
