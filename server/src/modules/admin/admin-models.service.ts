/**
 * 服务：AdminModelsService
 * 用途：后台模型审核（开发顺序第 9 步）：
 *  - findList：全状态模型列表（不受 published + public 限制，区别于游客 ModelsService）。
 *  - findOne：后台模型详情（按 id 直查，无可见性过滤）。
 *  - updateStatus：审核通过 / 驳回（状态机：approve 仅 pending→published；reject 仅 pending→rejected 且需 rejectReason）。
 * 红线：
 *  - 仅 admin 可调用（由 Controller 的 JwtAuthGuard + RolesGuard + @Roles('admin') 保证）。
 *  - BigInt 主键统一在 VM 层转 number。
 */
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ModelStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PaginatedResult } from '../users/users.service';
import { AdminModelVm, toAdminModelVm } from './admin.vm';
import { QueryAdminModelsDto } from './dto/query-admin-models.dto';
import { UpdateModelStatusDto } from './dto/update-model-status.dto';

@Injectable()
export class AdminModelsService {
  constructor(private readonly prisma: PrismaService) {}

  // 列表 / 详情查询统一附带的关联（发布者 + 分类）
  private readonly include = {
    user: { select: { id: true, nickname: true } },
    category: { select: { id: true, name: true, slug: true } },
  } satisfies Prisma.ModelInclude;

  /**
   * 后台模型列表（GET /api/admin/models）。
   * 支持 status（all 不过滤）、type、keyword（标题 + 作者昵称）过滤，按创建时间倒序分页。
   */
  async findList(query: QueryAdminModelsDto): Promise<PaginatedResult<AdminModelVm>> {
    const { status, type, keyword, page, pageSize } = query;
    const where: Prisma.ModelWhereInput = {};

    // 状态过滤：all 不过滤，其余精确匹配 ModelStatus
    if (status && status !== 'all') {
      where.status = status as ModelStatus;
    }

    // 分类名过滤
    if (type && type.trim()) {
      where.type = type.trim();
    }

    // 关键词：标题或作者昵称（不区分大小写）
    if (keyword && keyword.trim()) {
      const kw = keyword.trim();
      where.OR = [
        { title: { contains: kw, mode: 'insensitive' } },
        { user: { is: { nickname: { contains: kw, mode: 'insensitive' } } } },
      ];
    }

    const skip = (page - 1) * pageSize;
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.model.count({ where }),
      this.prisma.model.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        include: this.include,
      }),
    ]);

    return { list: rows.map(toAdminModelVm), total, page, pageSize };
  }

  /**
   * 后台模型详情（GET /api/admin/models/:id）。
   * 按 id 直查，无可见性过滤；未找到抛 404。
   */
  async findOne(id: bigint): Promise<AdminModelVm> {
    const model = await this.prisma.model.findUnique({
      where: { id },
      include: this.include,
    });
    if (!model) {
      throw new NotFoundException('模型不存在');
    }
    return toAdminModelVm(model);
  }

  /**
   * 审核模型（PATCH /api/admin/models/:id/status）。
   * 状态机红线：
   *  - approve：仅允许 pending → published（非 pending 抛 400）。
   *  - reject：仅允许 pending → rejected，rejectReason 必填（DTO 已校验），并写入驳回原因。
   */
  async updateStatus(id: bigint, dto: UpdateModelStatusDto): Promise<AdminModelVm> {
    const model = await this.prisma.model.findUnique({ where: { id } });
    if (!model) {
      throw new NotFoundException('模型不存在');
    }

    // 仅待审核（pending）状态可被审核，杜绝重复 / 跨状态审核
    if (model.status !== ModelStatus.pending) {
      throw new BadRequestException('仅待审核（pending）状态的模型可审核');
    }

    const data: Prisma.ModelUpdateInput =
      dto.action === 'approve'
        ? { status: ModelStatus.published, rejectReason: null } // 通过：发布并清空驳回原因
        : { status: ModelStatus.rejected, rejectReason: dto.rejectReason }; // 驳回：写入原因

    const updated = await this.prisma.model.update({
      where: { id },
      data,
      include: this.include,
    });
    return toAdminModelVm(updated);
  }
}
