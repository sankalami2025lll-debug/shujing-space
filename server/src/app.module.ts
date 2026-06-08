/**
 * 根模块：AppModule
 * 用途：装配基础设施模块（配置、Prisma、健康检查）。
 * 业务模块（认证/模型/上传/训练申请/联系/后台）按开发顺序逐步在此接入，预留位置见下方注释。
 */
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { configuration } from './config/configuration';
import { validateEnv } from './config/env.validation';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { ModelsModule } from './modules/models/models.module';
import { UploadsModule } from './modules/uploads/uploads.module';
import { UsersModule } from './modules/users/users.module';
import { ContactModule } from './modules/contact/contact.module';
import { TrainingModule } from './modules/training/training.module';
import { AdminModule } from './modules/admin/admin.module';
import { SiteConfigModule } from './modules/site-config/site-config.module';
import { UploadTasksModule } from './modules/upload-tasks/upload-tasks.module';

@Module({
  imports: [
    // 全局配置：加载并校验环境变量
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
      load: [configuration],
    }),
    // 全局数据库
    PrismaModule,
    // 健康检查
    HealthModule,
    // 第 4 步：认证模块 /api/auth/*
    AuthModule,
    // 第 5 步：分类读接口 /api/categories
    CategoriesModule,
    // 第 5 步：模型读接口 /api/models、/api/models/:id；第 6 步新增发布接口 POST /api/models
    ModelsModule,
    // 第 6 步：对象存储上传 /api/uploads/presign、/api/uploads/callback
    UploadsModule,
    // 第 6 步补充：上传任务持久化 /api/upload-tasks/*
    UploadTasksModule,
    // 第 7 步·第二阶段：个人中心 /api/users/me/*
    UsersModule,
    // 第 8 步·阶段一：联系线索 /api/contact/*（提交线索 + 表单选项）
    ContactModule,
    // 第 8 步·阶段二：训练数据服务申请 /api/training-applications（提交 + 我的申请）
    TrainingModule,
    // 第 9 步：后台管理 /api/admin/*（模型审核 / 用户 / 分类 / 线索 / 训练申请，仅 admin）
    AdminModule,
    // 站点配置：GET /api/site-config（游客）+ GET/PUT /api/admin/site-config（仅 admin）
    SiteConfigModule,
  ],
})
export class AppModule {}
