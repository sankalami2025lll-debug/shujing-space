/**
 * 控制器：AdminSiteConfigController
 * 用途：后台站点配置管理接口（仅 admin）：
 *  - GET /api/admin/site-config  读取当前站点配置
 *  - PUT /api/admin/site-config  批量更新站点配置（key/value）
 * 权限：类级 JwtAuthGuard + RolesGuard + @Roles('admin')；未登录 → 401，普通用户 → 403。
 */
import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UpdateSiteConfigDto } from './dto/update-site-config.dto';
import { SiteConfigService } from './site-config.service';

@ApiTags('admin-site-config')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.admin)
@Controller('admin/site-config')
export class AdminSiteConfigController {
  constructor(private readonly siteConfigService: SiteConfigService) {}

  // GET /api/admin/site-config：读取当前站点配置
  @Get()
  @ApiOperation({ summary: '后台读取站点配置' })
  async get() {
    return this.siteConfigService.getConfig();
  }

  // PUT /api/admin/site-config：批量更新站点配置（白名单 key/value）
  @Put()
  @ApiOperation({ summary: '后台批量更新站点配置（key/value）' })
  async update(@Body() dto: UpdateSiteConfigDto) {
    return this.siteConfigService.updateConfig(dto);
  }
}
