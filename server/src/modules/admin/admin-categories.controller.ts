/**
 * 控制器：AdminCategoriesController
 * 用途：后台分类管理接口（仅 admin），区别于游客只读的 GET /api/categories：
 *  - GET    /api/admin/categories       全部分类（含未启用，附 modelCount）
 *  - POST   /api/admin/categories       新增分类
 *  - PUT    /api/admin/categories/:id    编辑分类（名称/标识/排序/启停）
 *  - DELETE /api/admin/categories/:id    删除分类（被模型引用时拒绝）
 * 权限：类级 JwtAuthGuard + RolesGuard + @Roles('admin')；未登录 → 401，普通用户 → 403。
 */
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AdminCategoriesService } from './admin-categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@ApiTags('admin-categories')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.admin)
@Controller('admin/categories')
export class AdminCategoriesController {
  constructor(private readonly adminCategoriesService: AdminCategoriesService) {}

  // GET /api/admin/categories：全部分类（含未启用）
  @Get()
  @ApiOperation({ summary: '后台分类列表（含未启用，附关联模型数）' })
  async list() {
    return this.adminCategoriesService.findAll();
  }

  // POST /api/admin/categories：新增分类（name/slug 唯一 → 409）
  @Post()
  @ApiOperation({ summary: '新增分类（name/slug 唯一冲突返回 409）' })
  async create(@Body() dto: CreateCategoryDto) {
    return this.adminCategoriesService.create(dto);
  }

  // PUT /api/admin/categories/:id：编辑分类
  @Put(':id')
  @ApiOperation({ summary: '编辑分类（名称/标识/排序/启停）' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.adminCategoriesService.update(BigInt(id), dto);
  }

  // DELETE /api/admin/categories/:id：删除分类（被模型引用 → 400）
  @Delete(':id')
  @ApiOperation({ summary: '删除分类（被模型引用时拒绝，提示先停用或迁移）' })
  async remove(@Param('id', ParseIntPipe) id: number) {
    return this.adminCategoriesService.remove(BigInt(id));
  }
}
