/**
 * 服务：PrismaService
 * 用途：封装 PrismaClient，管理数据库连接生命周期，供全站注入使用。
 * 说明：onModuleInit 时连接数据库；提供 isHealthy() 供健康检查探活。
 */
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  // 模块初始化时建立数据库连接
  async onModuleInit() {
    await this.$connect();
    this.logger.log('PostgreSQL 已连接');
  }

  // 模块销毁时断开连接，避免连接泄露
  async onModuleDestroy() {
    await this.$disconnect();
  }

  /**
   * 数据库健康探活：执行 SELECT 1，成功返回 true。
   * 供 /api/health 调用。
   */
  async isHealthy(): Promise<boolean> {
    try {
      await this.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }
}
