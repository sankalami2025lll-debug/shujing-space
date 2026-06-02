/**
 * 控制器：InteractionsController
 * 用途：暴露模型「点赞 / 收藏」互动接口（均需登录）：
 *  - POST   /api/models/:id/like       点赞（幂等）
 *  - DELETE /api/models/:id/like       取消点赞（幂等）
 *  - POST   /api/models/:id/favorite   收藏（幂等）
 *  - DELETE /api/models/:id/favorite   取消收藏（幂等）
 * 说明：
 *  - 与 ModelsController 共用 `models` 路由前缀（NestJS 允许多个控制器同前缀）。
 *  - 全部挂 JwtAuthGuard：未登录访问 → 401。
 *  - :id 用 ParseIntPipe 校验（非数字 → 400）。
 *  - 返回 { liked/favorited, likesCount/favoritesCount } 供前端直接刷新角标。
 */
import {
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthUser } from '../auth/jwt-payload.interface';
import { InteractionsService } from './interactions.service';

@ApiTags('models')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('models')
export class InteractionsController {
  constructor(private readonly interactions: InteractionsService) {}

  // POST /api/models/:id/like：点赞（需登录，幂等）
  @Post(':id/like')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '点赞模型（需登录，幂等）' })
  async like(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.interactions.like(user.id, BigInt(id));
  }

  // DELETE /api/models/:id/like：取消点赞（需登录，幂等）
  @Delete(':id/like')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '取消点赞（需登录，幂等）' })
  async unlike(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.interactions.unlike(user.id, BigInt(id));
  }

  // POST /api/models/:id/favorite：收藏（需登录，幂等）
  @Post(':id/favorite')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '收藏模型（需登录，幂等）' })
  async favorite(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.interactions.favorite(user.id, BigInt(id));
  }

  // DELETE /api/models/:id/favorite：取消收藏（需登录，幂等）
  @Delete(':id/favorite')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '取消收藏（需登录，幂等）' })
  async unfavorite(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.interactions.unfavorite(user.id, BigInt(id));
  }
}
