/**
 * 模块：HealthModule
 * 用途：注册健康检查控制器。PrismaService 由全局 PrismaModule 提供。
 */
import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';

@Module({
  controllers: [HealthController],
})
export class HealthModule {}
