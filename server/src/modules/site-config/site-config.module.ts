/**
 * 模块：SiteConfigModule
 * 用途：装配站点全站配置的读取与后台维护接口：
 *  - 公开：GET /api/site-config（SiteConfigController，无 Guard）
 *  - 后台：GET/PUT /api/admin/site-config（AdminSiteConfigController，仅 admin）
 * 说明：
 *  - imports [AuthModule]：复用导出的 JwtAuthGuard / RolesGuard（admin 控制器类级 @Roles('admin')）。
 *  - PrismaService 由全局 PrismaModule 提供，无需在此 import。
 *  - 公开与后台两个 Controller 同放本模块，按「站点配置」领域内聚（service 单一来源）。
 */
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminSiteConfigController } from './admin-site-config.controller';
import { SiteConfigController } from './site-config.controller';
import { SiteConfigService } from './site-config.service';

@Module({
  imports: [AuthModule],
  controllers: [SiteConfigController, AdminSiteConfigController],
  providers: [SiteConfigService],
})
export class SiteConfigModule {}
