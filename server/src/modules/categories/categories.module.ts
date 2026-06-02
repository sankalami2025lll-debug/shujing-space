/**
 * 模块：CategoriesModule
 * 用途：装配分类读取接口（GET /api/categories）。
 * 说明：依赖全局 PrismaModule（已 isGlobal），无需重复 import；本阶段仅读、无 Guard。
 */
import { Module } from '@nestjs/common';
import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';

@Module({
  controllers: [CategoriesController],
  providers: [CategoriesService],
})
export class CategoriesModule {}
