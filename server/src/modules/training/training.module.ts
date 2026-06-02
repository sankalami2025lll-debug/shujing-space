/**
 * 模块：TrainingModule
 * 用途：装配训练数据服务申请接口 /api/training-applications（提交 + 我的申请）。
 * 说明：
 *  - imports AuthModule：复用其导出的 JwtAuthGuard / OptionalJwtAuthGuard。
 *    （POST 用可选登录态回填 userId；GET /my 用强登录态守卫）
 *  - 依赖全局 PrismaModule（已 isGlobal），无需重复 import。
 */
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { TrainingController } from './training.controller';
import { TrainingService } from './training.service';

@Module({
  imports: [AuthModule],
  controllers: [TrainingController],
  providers: [TrainingService],
})
export class TrainingModule {}
