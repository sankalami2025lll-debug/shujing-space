/**
 * 控制器：健康检查
 * 用途：提供 GET /api/health，用于探活与部署冒烟（含数据库连通性检测）。
 */
import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  // GET /api/health：返回服务状态与数据库连通性
  @Get()
  @ApiOperation({ summary: '服务健康检查（含数据库探活）' })
  async check() {
    const dbUp = await this.prisma.isHealthy();
    return {
      status: 'ok',
      db: dbUp ? 'up' : 'down',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
    };
  }
}
