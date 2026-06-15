import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import DysmsapiClient, { SendSmsRequest } from '@alicloud/dysmsapi20170525';
import { Config } from '@alicloud/openapi-client';

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private readonly client: DysmsapiClient;
  private readonly signName: string;
  private readonly templateCode: string;
  private readonly enabled: boolean;

  constructor(private readonly config: ConfigService) {
    const accessKeyId = (config.get<string>('sms.accessKeyId') ?? '').trim();
    const accessKeySecret = (config.get<string>('sms.accessKeySecret') ?? '').trim();
    const endpoint = (config.get<string>('sms.endpoint') ?? 'dysmsapi.aliyuncs.com').trim();
    this.signName = (config.get<string>('sms.signName') ?? '').trim();
    this.templateCode = (config.get<string>('sms.templateCode') ?? '').trim();

    this.enabled = Boolean(accessKeyId && accessKeySecret && this.signName && this.templateCode);

    if (this.enabled) {
      const aliyunConfig = new Config({
        accessKeyId,
        accessKeySecret,
        endpoint,
      });
      this.client = new DysmsapiClient(aliyunConfig);
      this.logger.log('阿里云短信服务已初始化');
    } else {
      this.logger.warn('阿里云短信配置不完整，短信发送不可用');
      this.client = null as unknown as DysmsapiClient;
    }
  }

  async sendSms(phoneNumber: string, code: string): Promise<void> {
    if (!this.enabled) {
      throw new ServiceUnavailableException('短信服务未配置，无法发送验证码');
    }

    const request = new SendSmsRequest({
      phoneNumbers: phoneNumber,
      signName: this.signName,
      templateCode: this.templateCode,
      templateParam: JSON.stringify({ code }),
    });

    try {
      const response = await this.client.sendSms(request);
      const body = response.body;
      if (!body) {
        throw new Error('阿里云短信响应体为空');
      }
      if (body.code !== 'OK') {
        this.logger.error(
          `阿里云短信发送失败 target=${phoneNumber} code=${body.code} message=${body.message}`,
        );
        throw new ServiceUnavailableException('短信发送失败，请稍后重试');
      }
      this.logger.log(`阿里云短信已发送 target=${phoneNumber} bizId=${body.bizId ?? '无'}`);
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        throw error;
      }
      this.logger.error(
        `阿里云短信请求异常 target=${phoneNumber}`,
        error instanceof Error ? error.message : undefined,
      );
      throw new ServiceUnavailableException('短信发送异常，请稍后重试');
    }
  }
}
