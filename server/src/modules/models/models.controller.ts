/**
 * 控制器：ModelsController
 * 用途：暴露模型接口：
 *  - GET  /api/models      模型列表（游客；type/keyword/sort/page/pageSize，返回 list+total）
 *  - GET  /api/models/:id  模型详情（OptionalJwtAuthGuard；公开模型游客可看，作者可看自己的非公开模型）
 *  - POST /api/models      发布模型（需登录；关联已上传对象存储文件）
 * 说明：响应体由全局 TransformInterceptor 统一包成 { code, message, data }，此处只返回业务数据。
 *       本阶段不实现编辑/删除/审核/点赞/收藏接口。
 */
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { AuthUser } from '../auth/jwt-payload.interface';
import { CreateModelDto } from './dto/create-model.dto';
import { QueryModelsDto } from './dto/query-models.dto';
import { UpdateLaunchViewDto } from './dto/update-launch-view.dto';
import { UpdateModelDto } from './dto/update-model.dto';
import { ModelsService } from './models.service';

@ApiTags('models')
@Controller('models')
export class ModelsController {
  constructor(private readonly modelsService: ModelsService) {}

  // GET /api/models：模型列表（仅已发布 + 公开），支持分类/关键词/排序/分页
  // 可选登录态：游客可访问；登录用户额外附带 isLiked / isFavorited（OptionalJwtAuthGuard 不拦截游客）
  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取模型列表（type/keyword/sort/page/pageSize；登录态附带 isLiked/isFavorited）' })
  async list(@CurrentUser() user: AuthUser | undefined, @Query() query: QueryModelsDto) {
    return this.modelsService.findList(query, user?.id);
  }

  // GET /api/models/:id：模型详情（2F）；游客/非作者仅 published+public；作者可看本人全状态模型
  // id 非数字 → 400，未找到/无权限 → 404；OptionalJwtAuthGuard 不强制登录
  @Get(':id')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      '获取模型详情（公开模型游客可看；作者可看自己的非公开模型；登录态附带 isLiked/isFavorited）',
  })
  async detail(
    @CurrentUser() user: AuthUser | undefined,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.modelsService.findOne(BigInt(id), user?.id);
  }

  // POST /api/models：发布模型（需登录）；关联已上传的模型/封面文件
  @Post()
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '发布模型（关联已上传对象存储文件，需登录）' })
  async create(@CurrentUser() user: AuthUser, @Body() dto: CreateModelDto) {
    return this.modelsService.create(user.id, dto);
  }

  // PUT /api/models/:id/launch-view：保存模型启动视图（需登录且仅作者本人可调用）
  @Put(':id/launch-view')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '保存模型启动视图（需登录且仅模型归属用户可调用）' })
  async saveLaunchView(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateLaunchViewDto,
  ) {
    return this.modelsService.saveLaunchView(user.id, BigInt(id), dto);
  }

  // DELETE /api/models/:id/launch-view：清空模型启动视图（需登录且仅作者本人可调用）
  @Delete(':id/launch-view')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '清空模型启动视图（需登录且仅模型归属用户可调用）' })
  async clearLaunchView(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.modelsService.clearLaunchView(user.id, BigInt(id));
  }

  // PATCH /api/models/:id：更新模型基础信息（需登录且仅作者本人可调用）。
  // 允许更新：title、description、coverUrl。
  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '更新模型基础信息（需登录且仅模型归属用户可调用）' })
  async update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateModelDto,
  ) {
    return this.modelsService.update(user.id, BigInt(id), dto);
  }

  // POST /api/models/:id/view：记录浏览量（2E）。游客 / 登录均可，无需鉴权（不挂 JwtAuthGuard）。
  // 仅对「已发布 + 公开」模型 viewsCount +1；不存在/不可见 → 404；返回最新 viewsCount。
  // 与 GET /api/models/:id 解耦：读接口保持只读语义，浏览量由前端详情页打开时单独打点。
  @Post(':id/view')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '记录模型浏览量（游客可用，viewsCount +1，返回最新值）' })
  async view(@Param('id', ParseIntPipe) id: number) {
    return this.modelsService.recordView(BigInt(id));
  }
}
