/**
 * 模块：UploadsModule
 * 用途：装配文件上传接口（/api/uploads/presign、/api/uploads/callback）。
 * 说明：
 *  - imports AuthModule：复用其导出的 JwtAuthGuard（依赖 TokenService）。
 *  - 依赖全局 PrismaModule（已 isGlobal）与 ConfigModule（isGlobal）。
 *  - 导出 R2Service，供 ModelsModule 在发布模型时按需复用（如反查/拼 URL）。
 */
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { R2Service } from './r2.service';
import { UploadsController } from './uploads.controller';
import { UploadsService } from './uploads.service';

@Module({
  imports: [AuthModule],
  controllers: [UploadsController],
  providers: [UploadsService, R2Service],
  exports: [R2Service],
})
export class UploadsModule {}
