/**
 * 模块：ModelsModule
 * 用途：装配模型接口：
 *  - 读接口：GET /api/models、GET /api/models/:id（游客可访问，OptionalJwtAuthGuard 登录态附带 isLiked/isFavorited）
 *  - 发布接口：POST /api/models（JwtAuthGuard）
 *  - 互动接口：POST/DELETE /api/models/:id/like、/favorite（JwtAuthGuard，见 InteractionsController）
 * 说明：
 *  - imports AuthModule：复用其导出的 JwtAuthGuard / OptionalJwtAuthGuard。
 *  - 依赖全局 PrismaModule（已 isGlobal），无需重复 import。
 */
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { InteractionsController } from './interactions.controller';
import { InteractionsService } from './interactions.service';
import { ModelsController } from './models.controller';
import { ModelsService } from './models.service';

@Module({
  imports: [AuthModule],
  controllers: [ModelsController, InteractionsController],
  providers: [ModelsService, InteractionsService],
})
export class ModelsModule {}
