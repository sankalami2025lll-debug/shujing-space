/**
 * 模块：AdminModule
 * 用途：装配后台管理（开发顺序第 9 步）五大子模块的 Controller / Service：
 *  - 模型审核（admin-models）
 *  - 用户管理（admin-users）
 *  - 分类管理（admin-categories）
 *  - 联系线索管理（admin-leads）
 *  - 训练申请管理（admin-training）
 * 说明：
 *  - imports [AuthModule]：复用导出的 JwtAuthGuard / RolesGuard（各 Controller 类级 @Roles('admin')）。
 *  - PrismaService 由全局 PrismaModule 提供，无需在此 import。
 *  - 本期不实现 site-config / audit_logs / 后台前端页面（见 dev-checkpoint）。
 */
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ModelsModule } from '../models/models.module';
import { AdminCategoriesController } from './admin-categories.controller';
import { AdminCategoriesService } from './admin-categories.service';
import { AdminLeadsController } from './admin-leads.controller';
import { AdminLeadsService } from './admin-leads.service';
import { AdminModelsController } from './admin-models.controller';
import { AdminModelsService } from './admin-models.service';
import { AdminTrainingController } from './admin-training.controller';
import { AdminTrainingService } from './admin-training.service';
import { AdminUsersController } from './admin-users.controller';
import { AdminUsersService } from './admin-users.service';

@Module({
  imports: [AuthModule, ModelsModule],
  controllers: [
    AdminModelsController,
    AdminUsersController,
    AdminCategoriesController,
    AdminLeadsController,
    AdminTrainingController,
  ],
  providers: [
    AdminModelsService,
    AdminUsersService,
    AdminCategoriesService,
    AdminLeadsService,
    AdminTrainingService,
  ],
})
export class AdminModule {}
