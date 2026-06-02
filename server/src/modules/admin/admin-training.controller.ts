/**
 * 控制器：AdminTrainingController
 * 用途：后台训练数据服务申请管理接口（仅 admin）：
 *  - GET    /api/admin/training-applications            申请列表（status/keyword/page/pageSize）
 *  - PATCH  /api/admin/training-applications/:id/status 申请状态流转（TrainingStatus 枚举）
 * 权限：类级 JwtAuthGuard + RolesGuard + @Roles('admin')；未登录 → 401，普通用户 → 403。
 */
import {
  Body,
  Controller,
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
import { AdminTrainingService } from './admin-training.service';
import { QueryAdminTrainingDto } from './dto/query-admin-training.dto';
import { UpdateTrainingStatusDto } from './dto/update-training-status.dto';

@ApiTags('admin-training')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.admin)
@Controller('admin/training-applications')
export class AdminTrainingController {
  constructor(private readonly adminTrainingService: AdminTrainingService) {}

  // GET /api/admin/training-applications：申请列表
  @Get()
  @ApiOperation({ summary: '后台训练数据服务申请列表（status/keyword 过滤）' })
  async list(@Query() query: QueryAdminTrainingDto) {
    return this.adminTrainingService.findList(query);
  }

  // PATCH /api/admin/training-applications/:id/status：更新申请状态
  @Patch(':id/status')
  @ApiOperation({ summary: '更新训练申请状态（TrainingStatus 枚举）' })
  async updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTrainingStatusDto,
  ) {
    return this.adminTrainingService.updateStatus(BigInt(id), dto);
  }
}
