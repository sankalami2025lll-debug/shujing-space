/**
 * 根模块：AppModule
 * 用途：装配基础设施模块（配置、Prisma、健康检查）。
 * 业务模块（认证/模型/上传/训练申请/联系/后台）按开发顺序逐步在此接入，预留位置见下方注释。
 */
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
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
import { AnnotationsModule } from './modules/annotations/annotations.module';

@Module({
  imports: [
    // 全局配置：加载并校验环境变量
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
      load: [configuration],
    }),
    // 全局限流：@nestjs/throttler，默认桶 60 次 / 60s / IP（trust proxy=1 已在 main.ts 设置，
    //           反代后 req.ip 取真实客户端 IP）。
    //   - 命中后抛 ThrottlerException（429），由全局 AllExceptionFilter 包装为 {code:429,message,data:null}，
    //     message 固定中文，不泄露内部路径/bucket/object key。
    //   - 通过 APP_GUARD 注册 ThrottlerGuard，全局生效；具体路由可用 @Throttle 覆盖默认限流。
    //   - 守卫执行顺序：APP_GUARD 先于控制器级 @UseGuards(JwtAuthGuard)，但 ThrottlerGuard 不解析 JWT，
    //     缺失/非法 token 时只按 IP 限流，不会抛认证错误，不绕过也不改变 JwtAuthGuard 行为。
    //   - 本阶段统一按 IP tracker；后续若多人共用 IP 出现误伤，再单独升级 user-aware tracker。
    ThrottlerModule.forRoot({
      throttlers: [{ name: 'default', ttl: 60_000, limit: 60 }],
      errorMessage: '请求过于频繁，请稍后再试',
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
    // 模型空间热点标注 /api/models/:modelId/annotations/*
    AnnotationsModule,
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
  providers: [
    // 全局限流守卫：所有路由默认 60/min/IP；具体接口在 controller 用 @Throttle 覆盖
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
