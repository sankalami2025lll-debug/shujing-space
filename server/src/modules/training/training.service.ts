/**
 * 服务：TrainingService
 * 用途：训练数据服务申请的业务逻辑（开发顺序第 8 步·阶段二）：
 *  - createApplication：写入 training_applications 表（status 固定 submitted，userId 登录态回填）。
 *  - findMyApplications：查询当前登录用户的申请列表（与 GET /api/users/me/applications 口径一致）。
 * 红线：
 *  - 仅服务「具身智能机器人训练场景」申请，不扩展其它服务类型。
 *  - trainTasks 以 Json 数组入库；游客提交时 userId 为 null。
 *  - findMyApplications 严格按 userId 过滤，禁止越权读他人申请。
 *  - BigInt 主键统一在 VM 层转 number。
 */
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { PaginatedResult } from '../users/users.service';
import { CreateTrainingApplicationDto } from './dto/create-training-application.dto';
import {
  ApplicationReceiptVm,
  MyApplicationVm,
  toApplicationReceiptVm,
  toMyApplicationVm,
} from './training.vm';

@Injectable()
export class TrainingService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 提交训练数据服务申请（POST /api/training-applications）。
   * status 固定 submitted；trainTasks 以 Json 数组入库；userId 登录态回填（游客为 null）。
   */
  async createApplication(
    dto: CreateTrainingApplicationDto,
    userId: bigint | null,
  ): Promise<ApplicationReceiptVm> {
    const app = await this.prisma.trainingApplication.create({
      data: {
        userId: userId ?? null,
        contactName: dto.contactName,
        contactWay: dto.contactWay,
        company: dto.company,
        robotType: dto.robotType,
        // 训练任务多选以 Json 数组入库；未填时存空数组（与 schema 默认一致）
        trainTasks: (dto.trainTasks ?? []) as Prisma.InputJsonValue,
        sceneDesc: dto.sceneDesc,
        // status 不接收前端入参，由 schema 默认 TrainingStatus.submitted 落库
      },
    });
    return toApplicationReceiptVm(app);
  }

  /**
   * 我的训练数据服务申请（GET /api/training-applications/my）。
   * 按创建时间倒序分页；严格按 userId 过滤。
   * 口径与 GET /api/users/me/applications 一致（复用 toMyApplicationVm）。
   */
  async findMyApplications(
    userId: bigint,
    pagination: PaginationDto,
  ): Promise<PaginatedResult<MyApplicationVm>> {
    const { page, pageSize } = pagination;
    const skip = (page - 1) * pageSize;

    const where: Prisma.TrainingApplicationWhereInput = { userId };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.trainingApplication.count({ where }),
      this.prisma.trainingApplication.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
    ]);

    return { list: rows.map(toMyApplicationVm), total, page, pageSize };
  }
}
