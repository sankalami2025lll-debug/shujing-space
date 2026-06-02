/**
 * 控制器：AdminUsersController
 * 用途：后台用户管理接口（仅 admin）：
 *  - GET    /api/admin/users            用户列表（keyword/role/status/page/pageSize）
 *  - PATCH  /api/admin/users/:id/status 启用/禁用 + 调整角色
 * 权限：类级 JwtAuthGuard + RolesGuard + @Roles('admin')；未登录 → 401，普通用户 → 403。
 * 红线：列表不返回 passwordHash（service VM 已脱敏）；管理员不能禁用/降级自己（service 拦截）。
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
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AuthUser } from '../auth/jwt-payload.interface';
import { AdminUsersService } from './admin-users.service';
import { QueryAdminUsersDto } from './dto/query-admin-users.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';

@ApiTags('admin-users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.admin)
@Controller('admin/users')
export class AdminUsersController {
  constructor(private readonly adminUsersService: AdminUsersService) {}

  // GET /api/admin/users：用户列表（脱敏，不含 passwordHash）
  @Get()
  @ApiOperation({ summary: '后台用户列表（keyword/role/status 过滤，脱敏）' })
  async list(@Query() query: QueryAdminUsersDto) {
    return this.adminUsersService.findList(query);
  }

  // PATCH /api/admin/users/:id/status：启用/禁用 + 调整角色（禁止操作自己降级/禁用）
  @Patch(':id/status')
  @ApiOperation({ summary: '更新用户状态/角色（禁止禁用或降级当前管理员自己）' })
  async updateStatus(
    @CurrentUser() operator: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateUserStatusDto,
  ) {
    return this.adminUsersService.updateStatus(operator.id, BigInt(id), dto);
  }
}
