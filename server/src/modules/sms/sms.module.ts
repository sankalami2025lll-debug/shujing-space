/**
 * 模块：SmsModule
 * 用途：封装阿里云短信服务，供 VerificationService 在生产环境发送验证码短信。
 * 说明：
 *  - 全局模块（@Global），所有服务无需额外导入即可注入 SmsService。
 *  - 开发环境不调用真实短信，SmsService 仅在 show 方法中调用 SDK。
 */
import { Global, Module } from '@nestjs/common';
import { SmsService } from './sms.service';

@Global()
@Module({
  providers: [SmsService],
  exports: [SmsService],
})
export class SmsModule {}
