/**
 * 控制器：AdminLeadsController
 * 用途：后台联系线索管理接口（仅 admin）：
 *  - GET    /api/admin/leads            线索列表（status/keyword/page/pageSize）
 *  - PATCH  /api/admin/leads/:id/status 线索状态流转（LeadStatus 枚举）
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
import { AdminLeadsService } from './admin-leads.service';
import { QueryAdminLeadsDto } from './dto/query-admin-leads.dto';
import { UpdateLeadStatusDto } from './dto/update-lead-status.dto';

@ApiTags('admin-leads')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.admin)
@Controller('admin/leads')
export class AdminLeadsController {
  constructor(private readonly adminLeadsService: AdminLeadsService) {}

  // GET /api/admin/leads：线索列表
  @Get()
  @ApiOperation({ summary: '后台联系线索列表（status/keyword 过滤）' })
  async list(@Query() query: QueryAdminLeadsDto) {
    return this.adminLeadsService.findList(query);
  }

  // PATCH /api/admin/leads/:id/status：更新线索状态
  @Patch(':id/status')
  @ApiOperation({ summary: '更新联系线索状态（LeadStatus 枚举）' })
  async updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateLeadStatusDto,
  ) {
    return this.adminLeadsService.updateStatus(BigInt(id), dto);
  }
}
