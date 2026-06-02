/**
 * 模块：PrismaModule（全局）
 * 用途：以全局模块方式提供 PrismaService，业务模块无需重复 import。
 */
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
