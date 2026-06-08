/**
 * 模块：UploadTasksModule
 * 用途：装配上传任务持久化接口（/api/upload-tasks/*）。
 */
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ModelsModule } from '../models/models.module';
import { UploadsModule } from '../uploads/uploads.module';
import { UploadTaskMultipartService } from './upload-task-multipart.service';
import { UploadTasksController } from './upload-tasks.controller';
import { UploadTasksService } from './upload-tasks.service';

@Module({
  imports: [AuthModule, ModelsModule, UploadsModule],
  controllers: [UploadTasksController],
  providers: [UploadTasksService, UploadTaskMultipartService],
  exports: [UploadTasksService],
})
export class UploadTasksModule {}
