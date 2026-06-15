import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { VerificationScene } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import { SmsService } from '../sms/sms.service';

const CODE_TTL_MS = 5 * 60 * 1000;
const RESEND_INTERVAL_MS = 60 * 1000;

@Injectable()
export class VerificationService {
  private readonly logger = new Logger(VerificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly smsService: SmsService,
  ) {}

  async sendCode(
    target: string,
    scene: VerificationScene,
  ): Promise<{ expiresIn: number; devCode?: string }> {
    const last = await this.prisma.verificationCode.findFirst({
      where: { target, scene },
      orderBy: { createdAt: 'desc' },
    });
    if (last && Date.now() - last.createdAt.getTime() < RESEND_INTERVAL_MS) {
      throw new BadRequestException('验证码发送过于频繁，请稍后再试');
    }

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

    const isProd = this.config.get<string>('nodeEnv') === 'production';

    if (isProd) {
      await this.smsService.sendSms(target, code);
      this.logger.log(`[短信发送] target=${target} scene=${scene}`);
      return { expiresIn: CODE_TTL_MS / 1000 };
    }

    this.logger.log(`[mock 验证码] target=${target} scene=${scene} code=${code}`);
    return { expiresIn: CODE_TTL_MS / 1000, devCode: code };
  }

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
    await this.prisma.verificationCode.update({
      where: { id: record.id },
      data: { used: true },
    });
  }

  private generateCode(): string {
    return Math.floor(Math.random() * 1_000_000)
      .toString()
      .padStart(6, '0');
  }
}
