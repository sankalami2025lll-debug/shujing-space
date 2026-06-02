/**
 * 服务：VerificationService
 * 用途：验证码的发送（生成 + 入库 + 限频）与校验（一次性、过期判断），操作 verification_codes 表。
 * 说明：
 *  - 本阶段不接真实短信/邮件，采用 mock：生成真实 6 位验证码并入库，开发环境把明文返回给前端联调。
 *  - 验证码以 bcryptjs 哈希存储（codeHash），不存明文。
 *  - 60s 限频：依据同 target+scene 最近一条 createdAt。
 *  - 5 分钟有效期；校验成功后置 used=true（一次性）。
 *  - 二期可整体迁移至 Redis（见 backend-architecture-plan.md）。
 */
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { VerificationScene } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';

// 验证码有效期（毫秒）：5 分钟
const CODE_TTL_MS = 5 * 60 * 1000;
// 发送限频窗口（毫秒）：60 秒
const RESEND_INTERVAL_MS = 60 * 1000;

@Injectable()
export class VerificationService {
  private readonly logger = new Logger(VerificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /**
   * 发送验证码：限频校验 → 生成 6 位码 → 哈希入库。
   * @returns 开发环境返回明文 devCode 供联调；生产环境返回 undefined。
   */
  async sendCode(
    target: string,
    scene: VerificationScene,
  ): Promise<{ expiresIn: number; devCode?: string }> {
    // 60s 限频：查最近一条记录的创建时间
    const last = await this.prisma.verificationCode.findFirst({
      where: { target, scene },
      orderBy: { createdAt: 'desc' },
    });
    if (last && Date.now() - last.createdAt.getTime() < RESEND_INTERVAL_MS) {
      throw new BadRequestException('验证码发送过于频繁，请稍后再试');
    }

    // 生成 6 位数字验证码并哈希存储
    const code = this.generateCode();
    const codeHash = await bcrypt.hash(code, 10);
    await this.prisma.verificationCode.create({
      data: {
        target,
        scene,
        codeHash,
        expiresAt: new Date(Date.now() + CODE_TTL_MS),
        used: false,
      },
    });

    // mock：未接短信服务，开发环境把明文回传 + 打日志；生产环境不暴露明文
    const isProd = this.config.get<string>('nodeEnv') === 'production';
    if (!isProd) {
      this.logger.log(`[mock 验证码] target=${target} scene=${scene} code=${code}`);
      return { expiresIn: CODE_TTL_MS / 1000, devCode: code };
    }
    return { expiresIn: CODE_TTL_MS / 1000 };
  }

  /**
   * 校验验证码：取最新一条未使用且未过期的记录比对；成功后置为已使用（一次性）。
   * 校验失败抛 400。
   */
  async verifyCode(
    target: string,
    scene: VerificationScene,
    code: string,
  ): Promise<void> {
    const record = await this.prisma.verificationCode.findFirst({
      where: { target, scene, used: false, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    if (!record) {
      throw new BadRequestException('验证码不存在或已过期，请重新获取');
    }
    const matched = await bcrypt.compare(code, record.codeHash);
    if (!matched) {
      throw new BadRequestException('验证码错误');
    }
    // 一次性：校验通过后置为已使用，防重放
    await this.prisma.verificationCode.update({
      where: { id: record.id },
      data: { used: true },
    });
  }

  // 生成 6 位数字验证码（000000~999999，左侧补零）
  private generateCode(): string {
    return Math.floor(Math.random() * 1_000_000)
      .toString()
      .padStart(6, '0');
  }
}
