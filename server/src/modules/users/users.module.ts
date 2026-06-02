/**
 * 模块：UsersModule
 * 用途：装配个人中心接口 /api/users/me/*（我的模型/发布/收藏/申请/统计）。
 * 说明：
 *  - imports AuthModule：复用其导出的 JwtAuthGuard（个人中心接口全部需登录）。
 *  - 依赖全局 PrismaModule（已 isGlobal），无需重复 import。
 */
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [AuthModule],
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
