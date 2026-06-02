/**
 * 服务：CategoriesService
 * 用途：查询启用中的模型分类列表，供前端筛选使用（对应前端 MODEL_TYPES 中除「全部模型」外的真实分类）。
 * 数据源：categories 表，仅返回 isActive=true，按 sort asc、id asc 排序。
 * 红线：BigInt 主键统一转 number 返回，规避序列化歧义。
 */
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

// 对外返回的分类视图（裁剪掉后台字段：isActive/createdAt/updatedAt 不下发给游客）
export interface CategoryVm {
  id: number; // 分类主键
  name: string; // 中文名（实景三维 / BIM 模型 / 构件级模型 / 具身智能机器人训练场景）
  slug: string; // 英文标识（reality-3d / bim / component / robot-training）
  sort: number; // 排序权重
}

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 查询启用中的分类列表（GET /api/categories）。
   * 过滤 isActive=true；排序 sort 升序、id 升序。
   */
  async findActive(): Promise<CategoryVm[]> {
    const rows = await this.prisma.category.findMany({
      where: { isActive: true },
      orderBy: [{ sort: 'asc' }, { id: 'asc' }],
    });
    // 裁剪并把 BigInt id 转 number
    return rows.map((c) => ({
      id: Number(c.id),
      name: c.name,
      slug: c.slug,
      sort: c.sort,
    }));
  }
}
