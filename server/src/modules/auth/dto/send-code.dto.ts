/**
 * DTO：发送验证码入参
 * 接口：POST /api/auth/send-code
 * 字段：
 *  - target：接收验证码的手机号或邮箱（必填）
 *  - scene：验证码用途场景（注册 / 登录 / 找回密码，必填）
 */
import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsString, MaxLength } from 'class-validator';

// 验证码场景枚举值（与 Prisma VerificationScene 对应）
export const VERIFICATION_SCENES = ['register', 'login', 'reset'] as const;
export type VerificationSceneValue = (typeof VERIFICATION_SCENES)[number];

export class SendCodeDto {
  // 接收方：手机号或邮箱
  @ApiProperty({ description: '手机号或邮箱', example: '13800000000' })
  @IsString({ message: 'target 必须为字符串' })
  @IsNotEmpty({ message: 'target 不能为空' })
  @MaxLength(120, { message: 'target 长度不能超过 120' })
  target!: string;

  // 用途场景：register / login / reset
  @ApiProperty({ description: '验证码用途', enum: VERIFICATION_SCENES })
  @IsIn(VERIFICATION_SCENES, { message: 'scene 必须为 register/login/reset 之一' })
  scene!: VerificationSceneValue;
}
