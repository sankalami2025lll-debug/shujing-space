/**
 * 服务：AdminTrainingService
 * 用途：后台训练数据服务申请管理（开发顺序第 9 步）：
 *  - findList：申请列表（status / keyword 过滤，分页，含申请人/游客区分）。
 *  - updateStatus：申请状态流转（须为 TrainingStatus 枚举）。
 * 红线：
 *  - 仅 admin 可调用（Controller Guard 保证）。
 *  - 状态值用现有 Prisma enum TrainingStatus，不自定义。
 *  - BigInt 主键统一在 VM 层转 number。
 */
import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PaginatedResult } from '../users/users.service';
import { AdminApplicationVm, toAdminApplicationVm } from './admin.vm';
import { QueryAdminTrainingDto } from './dto/query-admin-training.dto';
import { UpdateTrainingStatusDto } from './dto/update-training-status.dto';

@Injectable()
export class AdminTrainingService {
  constructor(private readonly prisma: PrismaService) {}

  // 查询附带的关联（申请人昵称，游客申请 user 为 null）
  private readonly include = {
    user: { select: { id: true, nickname: true } },
  } satisfies Prisma.TrainingApplicationInclude;

  /**
   * 后台训练申请列表（GET /api/admin/training-applications）。
   * status 精确过滤；keyword 匹配联系人 / 公司 / 联系方式；按创建时间倒序分页。
   */
  async findList(
    query: QueryAdminTrainingDto,
  ): Promise<PaginatedResult<AdminApplicationVm>> {
    const { status, keyword, page, pageSize } = query;
    const where: Prisma.TrainingApplicationWhereInput = {};

    if (status) {
      where.status = status;
    }
    if (keyword && keyword.trim()) {
      const kw = keyword.trim();
      where.OR = [
        { contactName: { contains: kw, mode: 'insensitive' } },
        { company: { contains: kw, mode: 'insensitive' } },
        { contactWay: { contains: kw, mode: 'insensitive' } },
      ];
    }

    const skip = (page - 1) * pageSize;
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.trainingApplication.count({ where }),
      this.prisma.trainingApplication.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        include: this.include,
      }),
    ]);

    return { list: rows.map(toAdminApplicationVm), total, page, pageSize };
  }

  /**
   * 更新申请状态（PATCH /api/admin/training-applications/:id/status）。
   * 不存在 → 404；status 由 DTO 限定为 TrainingStatus 枚举。
   */
  async updateStatus(
    id: bigint,
    dto: UpdateTrainingStatusDto,
  ): Promise<AdminApplicationVm> {
    const exists = await this.prisma.trainingApplication.findUnique({ where: { id } });
    if (!exists) {
      throw new NotFoundException('训练数据服务申请不存在');
    }
    const updated = await this.prisma.trainingApplication.update({
      where: { id },
      data: { status: dto.status },
      include: this.include,
    });
    return toAdminApplicationVm(updated);
  }
}
