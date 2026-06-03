/**
 * 控制器：UsersController
 * 用途：暴露个人中心 /api/users/me/* 接口（全部需登录）：
 *  - GET /api/users/me/models        我的模型（本人全部状态，支持 status 过滤）
 *  - GET /api/users/me/published     我的发布（仅 published）
 *  - GET /api/users/me/favorites     我的收藏（附 isFavorited/isAvailable/favoritedAt）
 *  - GET /api/users/me/applications  我的训练数据服务申请（无数据返回空数组）
 *  - GET /api/users/me/stats         个人中心统计角标
 * 说明：
 *  - 类级 @UseGuards(JwtAuthGuard)：未登录访问任一接口 → 401。
 *  - @CurrentUser() 取当前登录用户，service 一律按 user.id 过滤，禁止越权。
 *  - 个人信息（GET /api/users/me）不在此实现，继续使用 GET /api/auth/me。
 *  - 响应体由全局 TransformInterceptor 统一包成 { code, message, data }。
 */
import { Controller, Delete, Get, Param, ParseIntPipe, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthUser } from '../auth/jwt-payload.interface';
import { QueryMyModelsDto } from './dto/query-my-models.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // GET /api/users/me/models：我的模型（本人全部状态，支持 status 过滤）
  @Get('me/models')
  @ApiOperation({ summary: '我的模型（本人全部状态，status=all/draft/pending/published/rejected）' })
  async myModels(@CurrentUser() user: AuthUser, @Query() query: QueryMyModelsDto) {
    return this.usersService.findMyModels(user.id, query);
  }

  // GET /api/users/me/published：我的发布（仅 published）
  @Get('me/published')
  @ApiOperation({ summary: '我的发布（仅 published）' })
  async myPublished(@CurrentUser() user: AuthUser, @Query() pagination: PaginationDto) {
    return this.usersService.findMyPublished(user.id, pagination);
  }

  // GET /api/users/me/favorites：我的收藏
  @Get('me/favorites')
  @ApiOperation({ summary: '我的收藏（含 isFavorited/isAvailable/favoritedAt）' })
  async myFavorites(@CurrentUser() user: AuthUser, @Query() pagination: PaginationDto) {
    return this.usersService.findMyFavorites(user.id, pagination);
  }

  // GET /api/users/me/applications：我的训练数据服务申请
  @Get('me/applications')
  @ApiOperation({ summary: '我的训练数据服务申请（无数据返回空数组）' })
  async myApplications(@CurrentUser() user: AuthUser, @Query() pagination: PaginationDto) {
    return this.usersService.findMyApplications(user.id, pagination);
  }

  // GET /api/users/me/stats：个人中心统计角标
  @Get('me/stats')
  @ApiOperation({ summary: '个人中心统计（models/published/pending/rejected/favorites/applications）' })
  async stats(@CurrentUser() user: AuthUser) {
    return this.usersService.getStats(user.id);
  }

  // DELETE /api/users/me/models/:id：删除自己的模型（软删除，幂等）
  @Delete('me/models/:id')
  @ApiOperation({ summary: '删除自己的模型（软删除；仅本人可删；重复删除幂等）' })
  async deleteMyModel(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.usersService.deleteOwnModel(user.id, BigInt(id));
  }
}
