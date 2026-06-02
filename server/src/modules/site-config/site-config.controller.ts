/**
 * 控制器：SiteConfigController
 * 用途：暴露游客可访问的站点配置读取接口：
 *  - GET /api/site-config  读取 Footer 联系方式 / 备案号 / 公司名 / 版权文案
 * 说明：
 *  - 公开接口，无 Guard；只返回 6 个白名单字段（phone/email/address/icp/companyName/footerText）。
 *  - 响应体由全局 TransformInterceptor 统一包成 { code, message, data }。
 */
import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SiteConfigService } from './site-config.service';

@ApiTags('site-config')
@Controller('site-config')
export class SiteConfigController {
  constructor(private readonly siteConfigService: SiteConfigService) {}

  // GET /api/site-config：游客读取公开站点配置
  @Get()
  @ApiOperation({ summary: '读取站点配置（Footer 联系方式 / 备案 / 公司名 / 版权）' })
  async get() {
    return this.siteConfigService.getConfig();
  }
}
