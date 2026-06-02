/**
 * 服务：AdminCategoriesService
 * 用途：后台分类管理（开发顺序第 9 步），区别于游客只读的 CategoriesService：
 *  - findAll：全部分类（含未启用），附带关联模型数 modelCount。
 *  - create / update：增改，name / slug 唯一冲突 → 409。
 *  - remove：删除；被模型引用时拒绝（提示先停用或迁移）。
 * 红线：
 *  - 唯一约束 P2002 统一转 409。
 *  - 被引用分类禁止硬删（外键完整性），引导用 isActive=false 停用。
 *  - BigInt 主键统一在 VM 层转 number。
 */
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AdminCategoryVm, toAdminCategoryVm } from './admin.vm';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class AdminCategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 全部分类列表（GET /api/admin/categories）。
   * 含未启用分类，按 sort asc、id asc 排序；附带每个分类的关联模型数（便于前端判断能否删除）。
   */
  async findAll(): Promise<AdminCategoryVm[]> {
    const rows = await this.prisma.category.findMany({
      orderBy: [{ sort: 'asc' }, { id: 'asc' }],
    });

    // 批量统计各分类关联模型数（一次 groupBy，避免 N+1）
    const grouped = await this.prisma.model.groupBy({
      by: ['categoryId'],
      _count: { _all: true },
    });
    const countMap = new Map<string, number>();
    for (const g of grouped) {
      if (g.categoryId != null) {
        countMap.set(g.categoryId.toString(), g._count._all);
      }
    }

    return rows.map((c) =>
      toAdminCategoryVm(c, countMap.get(c.id.toString()) ?? 0),
    );
  }

  /**
   * 新增分类（POST /api/admin/categories）。
   * name / slug 唯一；冲突时捕获 P2002 → 409。
   */
  async create(dto: CreateCategoryDto): Promise<AdminCategoryVm> {
    try {
      const created = await this.prisma.category.create({
        data: {
          name: dto.name,
          slug: dto.slug,
          sort: dto.sort ?? 0,
          isActive: dto.isActive ?? true,
        },
      });
      return toAdminCategoryVm(created, 0);
    } catch (e) {
      this.handleUniqueConflict(e);
    }
  }

  /**
   * 编辑分类（PUT /api/admin/categories/:id）。
   * 至少传一项可变更字段；name / slug 唯一冲突 → 409；不存在 → 404。
   */
  async update(id: bigint, dto: UpdateCategoryDto): Promise<AdminCategoryVm> {
    if (
      dto.name === undefined &&
      dto.slug === undefined &&
      dto.sort === undefined &&
      dto.isActive === undefined
    ) {
      throw new BadRequestException('name / slug / sort / isActive 至少需要提供一项');
    }

    const exists = await this.prisma.category.findUnique({ where: { id } });
    if (!exists) {
      throw new NotFoundException('分类不存在');
    }

    try {
      const updated = await this.prisma.category.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.slug !== undefined ? { slug: dto.slug } : {}),
          ...(dto.sort !== undefined ? { sort: dto.sort } : {}),
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        },
      });
      // 编辑后附带最新关联模型数
      const modelCount = await this.prisma.model.count({
        where: { categoryId: id },
      });
      return toAdminCategoryVm(updated, modelCount);
    } catch (e) {
      this.handleUniqueConflict(e);
    }
  }

  /**
   * 删除分类（DELETE /api/admin/categories/:id）。
   * 红线：被模型引用时拒绝删除（400），提示先停用（isActive=false）或迁移模型。
   */
  async remove(id: bigint): Promise<{ id: number; deleted: true }> {
    const exists = await this.prisma.category.findUnique({ where: { id } });
    if (!exists) {
      throw new NotFoundException('分类不存在');
    }

    const modelCount = await this.prisma.model.count({ where: { categoryId: id } });
    if (modelCount > 0) {
      throw new BadRequestException(
        `该分类下仍有 ${modelCount} 个模型，无法删除，请先停用该分类或迁移其下模型`,
      );
    }

    await this.prisma.category.delete({ where: { id } });
    return { id: Number(id), deleted: true };
  }

  /**
   * 统一处理 Prisma 唯一约束冲突（P2002）→ 409。
   * 返回 never：始终抛异常，供 catch 分支收口类型。
   */
  private handleUniqueConflict(e: unknown): never {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      throw new ConflictException('分类名或英文标识已存在');
    }
    throw e;
  }
}
