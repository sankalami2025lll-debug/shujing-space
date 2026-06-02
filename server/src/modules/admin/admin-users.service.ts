/**
 * 服务：AdminUsersService
 * 用途：后台用户管理（开发顺序第 9 步）：
 *  - findList：用户列表（keyword / role / status 过滤，分页）。
 *  - updateStatus：启用 / 禁用、调整角色。
 * 红线：
 *  - 绝不返回 passwordHash（统一走 toAdminUserVm 显式挑字段）。
 *  - 管理员不能禁用或降级自己（用当前登录 admin id 拦截，防自锁后台）。
 *  - BigInt 主键统一在 VM 层转 number。
 */
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, UserRole, UserStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PaginatedResult } from '../users/users.service';
import { AdminUserVm, toAdminUserVm } from './admin.vm';
import { QueryAdminUsersDto } from './dto/query-admin-users.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';

@Injectable()
export class AdminUsersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 后台用户列表（GET /api/admin/users）。
   * keyword 匹配昵称 / 手机 / 邮箱；role、status 精确过滤；按创建时间倒序分页。
   */
  async findList(query: QueryAdminUsersDto): Promise<PaginatedResult<AdminUserVm>> {
    const { keyword, role, status, page, pageSize } = query;
    const where: Prisma.UserWhereInput = {};

    if (role) {
      where.role = role;
    }
    if (status) {
      where.status = status;
    }
    if (keyword && keyword.trim()) {
      const kw = keyword.trim();
      where.OR = [
        { nickname: { contains: kw, mode: 'insensitive' } },
        { phone: { contains: kw, mode: 'insensitive' } },
        { email: { contains: kw, mode: 'insensitive' } },
      ];
    }

    const skip = (page - 1) * pageSize;
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
    ]);

    return { list: rows.map(toAdminUserVm), total, page, pageSize };
  }

  /**
   * 更新用户状态 / 角色（PATCH /api/admin/users/:id/status）。
   * 安全红线：
   *  - status / role 至少传一项。
   *  - 当前登录管理员不能禁用自己、也不能把自己降级为 user（防自锁后台）。
   */
  async updateStatus(
    operatorId: bigint,
    targetId: bigint,
    dto: UpdateUserStatusDto,
  ): Promise<AdminUserVm> {
    // 至少传一项可变更字段
    if (dto.status === undefined && dto.role === undefined) {
      throw new BadRequestException('status 与 role 至少需要提供一项');
    }

    const target = await this.prisma.user.findUnique({ where: { id: targetId } });
    if (!target) {
      throw new NotFoundException('用户不存在');
    }

    // 操作对象是当前登录管理员本人时，禁止禁用 / 降级，防止把自己锁出后台
    const isSelf = operatorId === targetId;
    if (isSelf && dto.status === UserStatus.disabled) {
      throw new BadRequestException('不能禁用当前登录的管理员账号');
    }
    if (isSelf && dto.role === UserRole.user) {
      throw new BadRequestException('不能将当前登录的管理员降级为普通用户');
    }

    const updated = await this.prisma.user.update({
      where: { id: targetId },
      data: {
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.role !== undefined ? { role: dto.role } : {}),
      },
    });
    return toAdminUserVm(updated);
  }
}
