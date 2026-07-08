/**
 * 模块：AnnotationsModule
 * 用途：装配模型空间热点标注接口（/api/models/:modelId/annotations/*）。
 * 依赖：
 *  - AuthModule：复用 JwtAuthGuard / OptionalJwtAuthGuard。
 *  - ModelsModule：复用 ModelsService.findOne 用于读接口的模型可见性校验。
 *  - 全局 PrismaModule（已 isGlobal）。
 */
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ModelsModule } from '../models/models.module';
import { AnnotationsController } from './annotations.controller';
import { AnnotationsService } from './annotations.service';

@Module({
  imports: [AuthModule, ModelsModule],
  controllers: [AnnotationsController],
  providers: [AnnotationsService],
})
export class AnnotationsModule {}
