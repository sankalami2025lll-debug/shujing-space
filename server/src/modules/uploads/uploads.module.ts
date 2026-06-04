/**
 * 模块：UploadsModule
 * 用途：装配文件上传接口（/api/uploads/presign、/api/uploads/callback）。
 * 说明：
 *  - imports AuthModule：复用其导出的 JwtAuthGuard（依赖 TokenService）。
 *  - 依赖全局 PrismaModule（已 isGlobal）与 ConfigModule（isGlobal）。
 *  - 同时装配 R2Service / OssService，由 UploadsService 按 STORAGE_DRIVER 选择。
 */
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { OssService } from './oss.service';
import { R2Service } from './r2.service';
import { UploadsController } from './uploads.controller';
import { UploadsService } from './uploads.service';

@Module({
  imports: [AuthModule],
  controllers: [UploadsController],
  providers: [UploadsService, R2Service, OssService],
  exports: [R2Service, OssService],
})
export class UploadsModule {}
