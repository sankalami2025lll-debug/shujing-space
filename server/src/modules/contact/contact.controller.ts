/**
 * 控制器：ContactController
 * 用途：暴露联系我们相关接口（开发顺序第 8 步·ContactModule）：
 *  - POST /api/contact/leads    提交联系线索（游客可提交，无需登录）
 *  - GET  /api/contact/options  获取表单选项配置（游客可访问）
 * 说明：
 *  - 两接口均为公开接口，无 Guard（contact_leads 表无 user_id，不需登录态）。
 *  - 响应体由全局 TransformInterceptor 统一包成 { code, message, data }。
 */
import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ContactService } from './contact.service';
import { CreateLeadDto } from './dto/create-lead.dto';

@ApiTags('contact')
@Controller('contact')
export class ContactController {
  constructor(private readonly contactService: ContactService) {}

  // POST /api/contact/leads：提交联系线索（游客可提交）
  // IP 限流：同一 IP 60s 内最多 5 次，防止联系表单被 spam 刷量
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('leads')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '提交联系线索（游客可提交，status 固定 new）' })
  async createLead(@Body() dto: CreateLeadDto) {
    return this.contactService.createLead(dto);
  }

  // GET /api/contact/options：获取表单选项配置（游客可访问）
  // 走全局默认限流（60/min/IP）
  @Get('options')
  @ApiOperation({ summary: '获取联系表单选项配置（业务场景/数据类型/项目阶段/预算范围）' })
  getOptions() {
    return this.contactService.getOptions();
  }
}
