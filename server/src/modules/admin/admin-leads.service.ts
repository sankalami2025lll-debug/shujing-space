/**
 * 服务：AdminLeadsService
 * 用途：后台联系线索管理（开发顺序第 9 步）：
 *  - findList：线索列表（status / keyword 过滤，分页）。
 *  - updateStatus：线索状态流转（须为 LeadStatus 枚举）。
 * 红线：
 *  - 仅 admin 可调用（Controller Guard 保证）。
 *  - 状态值用现有 Prisma enum LeadStatus，不自定义。
 *  - BigInt 主键统一在 VM 层转 number。
 */
import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PaginatedResult } from '../users/users.service';
import { AdminLeadVm, toAdminLeadVm } from './admin.vm';
import { QueryAdminLeadsDto } from './dto/query-admin-leads.dto';
import { UpdateLeadStatusDto } from './dto/update-lead-status.dto';

@Injectable()
export class AdminLeadsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 后台联系线索列表（GET /api/admin/leads）。
   * status 精确过滤；keyword 匹配姓名 / 联系方式 / 公司 / 邮箱；按创建时间倒序分页。
   */
  async findList(query: QueryAdminLeadsDto): Promise<PaginatedResult<AdminLeadVm>> {
    const { status, keyword, page, pageSize } = query;
    const where: Prisma.ContactLeadWhereInput = {};

    if (status) {
      where.status = status;
    }
    if (keyword && keyword.trim()) {
      const kw = keyword.trim();
      where.OR = [
        { name: { contains: kw, mode: 'insensitive' } },
        { contactWay: { contains: kw, mode: 'insensitive' } },
        { company: { contains: kw, mode: 'insensitive' } },
        { email: { contains: kw, mode: 'insensitive' } },
      ];
    }

    const skip = (page - 1) * pageSize;
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.contactLead.count({ where }),
      this.prisma.contactLead.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
    ]);

    return { list: rows.map(toAdminLeadVm), total, page, pageSize };
  }

  /**
   * 更新线索状态（PATCH /api/admin/leads/:id/status）。
   * 不存在 → 404；status 由 DTO 限定为 LeadStatus 枚举。
   */
  async updateStatus(id: bigint, dto: UpdateLeadStatusDto): Promise<AdminLeadVm> {
    const exists = await this.prisma.contactLead.findUnique({ where: { id } });
    if (!exists) {
      throw new NotFoundException('联系线索不存在');
    }
    const updated = await this.prisma.contactLead.update({
      where: { id },
      data: { status: dto.status },
    });
    return toAdminLeadVm(updated);
  }
}
