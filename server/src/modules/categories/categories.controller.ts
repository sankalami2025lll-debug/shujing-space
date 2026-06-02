/**
 * 控制器：CategoriesController
 * 用途：暴露 GET /api/categories 分类读取接口（游客可访问，无需登录）。
 * 说明：响应体由全局 TransformInterceptor 统一包成 { code, message, data }，此处只返回业务数据。
 */
import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CategoriesService } from './categories.service';

@ApiTags('categories')
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  // GET /api/categories：返回启用中的分类列表（按 sort asc、id asc 排序）
  @Get()
  @ApiOperation({ summary: '获取启用中的分类列表（前端筛选用）' })
  async list() {
    return this.categoriesService.findActive();
  }
}
