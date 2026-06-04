/**
 * 控制器：AdminModelsController
 * 用途：后台模型审核接口（仅 admin）：
 *  - GET    /api/admin/models           全状态模型列表（status/type/keyword/page/pageSize）
 *  - GET    /api/admin/models/:id        后台模型详情
 *  - PATCH  /api/admin/models/:id/status 审核通过 / 驳回
 * 权限：类级 JwtAuthGuard + RolesGuard + @Roles('admin')；
 *       未登录 → 401，普通用户 → 403。
 * 说明：:id 用 ParseIntPipe 校验（非数字 → 400），再转 BigInt 传入 service。
 */
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthUser } from '../auth/jwt-payload.interface';
import { AdminModelsService } from './admin-models.service';
import { DeleteModelDto } from './dto/delete-model.dto';
import { QueryAdminModelsDto } from './dto/query-admin-models.dto';
import { UpdateModelProcessingDto } from './dto/update-model-processing.dto';
import { UpdateModelStatusDto } from './dto/update-model-status.dto';

@ApiTags('admin-models')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.admin)
@Controller('admin/models')
export class AdminModelsController {
  constructor(private readonly adminModelsService: AdminModelsService) {}

  // GET /api/admin/models：全状态模型列表
  @Get()
  @ApiOperation({ summary: '后台模型列表（全状态，status/type/keyword 过滤）' })
  async list(@Query() query: QueryAdminModelsDto) {
    return this.adminModelsService.findList(query);
  }

  // GET /api/admin/models/:id：后台模型详情
  @Get(':id')
  @ApiOperation({ summary: '后台模型详情' })
  async detail(@Param('id', ParseIntPipe) id: number) {
    return this.adminModelsService.findOne(BigInt(id));
  }

  // PATCH /api/admin/models/:id/status：审核通过 / 驳回
  @Patch(':id/status')
  @ApiOperation({ summary: '审核模型（approve 仅 pending→published / reject 仅 pending→rejected）' })
  async updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateModelStatusDto,
  ) {
    return this.adminModelsService.updateStatus(BigInt(id), dto);
  }

  // PATCH /api/admin/models/:id/processing：手动标记解析完成 / 失败
  @Patch(':id/processing')
  @ApiOperation({ summary: '手动更新模型处理状态（mark_ready / mark_failed）' })
  async updateProcessing(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateModelProcessingDto,
  ) {
    return this.adminModelsService.updateProcessingStatus(BigInt(id), dto);
  }

  // DELETE /api/admin/models/:id：后台删除任意模型（软删除，幂等）
  @Delete(':id')
  @ApiOperation({ summary: '后台删除模型（软删除；仅 admin；重复删除幂等）' })
  async deleteModel(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: DeleteModelDto,
  ) {
    return this.adminModelsService.softDelete(BigInt(id), user.id, dto);
  }
}
