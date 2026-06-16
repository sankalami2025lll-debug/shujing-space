/**
 * 服务：AuthService
 * 用途：注册、登录（密码 / 验证码）、找回密码、获取当前用户的核心业务。
 * 依赖：PrismaService（users 表）、VerificationService（验证码）、TokenService（JWT）、bcryptjs（密码哈希）。
 * 红线：不返回 passwordHash；不在日志/响应中暴露密码；BigInt 主键统一转为 number 返回。
 */
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma, User, UserStatus, VerificationScene } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { TokenService } from './token.service';
import { VerificationService } from './verification.service';

// 简单邮箱判定正则：含 @ 且形如 a@b.c
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// 简单手机号判定正则：11 位、1 开头
const PHONE_REGEX = /^1\d{10}$/;

// 对外返回的用户视图（脱敏，不含 passwordHash；id 转 number 规避 BigInt 序列化）
export interface UserVm {
  id: number;
  nickname: string;
  role: User['role'];
  status: UserStatus;
  phone: string | null;
  email: string | null;
  company: string | null;
  roleType: string | null;
  avatarUrl: string | null;
  createdAt: Date;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly verification: VerificationService,
    private readonly tokenService: TokenService,
  ) {}

  /**
   * 注册：校验验证码 → 查重 → 哈希密码 → 创建用户 → 直接签发 token（注册即登录）。
   */
  async register(dto: RegisterDto): Promise<{ accessToken: string; user: UserVm }> {
    const { field, value } = this.resolveAccount(dto.account);

    // 校验注册验证码（scene=register）
    await this.verification.verifyCode(dto.account, VerificationScene.register, dto.code);

    // 哈希密码后创建用户；用唯一约束兜底并发查重
    const passwordHash = await bcrypt.hash(dto.password, 10);
    try {
      const user = await this.prisma.user.create({
        data: {
          phone: field === 'phone' ? value : null,
          email: field === 'email' ? value : null,
          passwordHash,
          nickname: this.defaultNickname(dto.account),
          company: dto.company ?? null,
          roleType: dto.roleType ?? null,
        },
      });
      const accessToken = this.tokenService.signAccessToken(user.id, user.role);
      return { accessToken, user: this.toUserVm(user) };
    } catch (e) {
      // 捕获唯一约束冲突（P2002）：手机号/邮箱已注册
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('该账号已注册，请直接登录');
      }
      throw e;
    }
  }

  /**
   * 登录：支持密码登录与验证码登录两种方式，校验账号状态后签发 token。
   */
  async login(dto: LoginDto): Promise<{ accessToken: string; user: UserVm }> {
    const user = await this.findByAccount(dto.account);

    if (dto.loginType === 'code') {
      // 验证码登录：用户不存在时统一提示，不暴露账号是否注册
      if (!user) {
        throw new UnauthorizedException('验证码错误或账号不存在');
      }
      if (user.status === UserStatus.disabled) {
        throw new UnauthorizedException('账号已被禁用，请联系管理员');
      }
      if (!dto.code) {
        throw new BadRequestException('请输入验证码');
      }
      await this.verification.verifyCode(dto.account, VerificationScene.login, dto.code);
    } else {
      // 密码登录：用户不存在 / 未设置密码 / 密码不匹配 都返回同一文案，避免账号枚举
      if (!user || !user.passwordHash) {
        throw new UnauthorizedException('账号或密码错误');
      }
      if (user.status === UserStatus.disabled) {
        throw new UnauthorizedException('账号已被禁用，请联系管理员');
      }
      if (!dto.password) {
        throw new BadRequestException('请输入密码');
      }
      const matched = await bcrypt.compare(dto.password, user.passwordHash);
      if (!matched) {
        throw new UnauthorizedException('账号或密码错误');
      }
    }

    const accessToken = this.tokenService.signAccessToken(user.id, user.role);
    return { accessToken, user: this.toUserVm(user) };
  }

  /**
   * 找回 / 重置密码：校验 reset 验证码 → 更新密码哈希。
   */
  async resetPassword(dto: ResetPasswordDto): Promise<{ reset: true }> {
    const user = await this.findByAccount(dto.account);
    if (!user) {
      throw new NotFoundException('账号未注册或重置链接失效');
    }
    await this.verification.verifyCode(dto.account, VerificationScene.reset, dto.code);
    const passwordHash = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });
    return { reset: true };
  }

  /**
   * 获取当前登录用户信息（供 GET /api/auth/me）。
   */
  async getMe(userId: bigint): Promise<UserVm> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('用户不存在');
    }
    return this.toUserVm(user);
  }

  // —— 内部工具 ——

  // 判定账号是手机号还是邮箱，返回对应的查询字段名与值
  private resolveAccount(account: string): { field: 'phone' | 'email'; value: string } {
    if (EMAIL_REGEX.test(account)) {
      return { field: 'email', value: account };
    }
    if (PHONE_REGEX.test(account)) {
      return { field: 'phone', value: account };
    }
    throw new BadRequestException('请输入正确的手机号或邮箱');
  }

  // 按账号（手机号/邮箱）查询用户
  private async findByAccount(account: string): Promise<User | null> {
    const { field, value } = this.resolveAccount(account);
    return this.prisma.user.findUnique({
      where: field === 'email' ? { email: value } : { phone: value },
    });
  }

  // 默认昵称：手机号脱敏（138****0000）/ 邮箱取 @ 前缀
  private defaultNickname(account: string): string {
    if (EMAIL_REGEX.test(account)) {
      return account.split('@')[0];
    }
    if (PHONE_REGEX.test(account)) {
      return `${account.slice(0, 3)}****${account.slice(7)}`;
    }
    return account;
  }

  // 用户实体 → 脱敏视图（不含 passwordHash；id 转 number）
  private toUserVm(user: User): UserVm {
    return {
      id: Number(user.id),
      nickname: user.nickname,
      role: user.role,
      status: user.status,
      phone: user.phone,
      email: user.email,
      company: user.company,
      roleType: user.roleType,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt,
    };
  }
}
