/**
 * 服务：ContactService
 * 用途：联系我们表单的业务逻辑（开发顺序第 8 步·ContactModule）：
 *  - createLead：写入 contact_leads 表（游客线索，status 固定 new）。
 *  - getOptions：返回表单选项配置（业务场景/数据类型/项目阶段/预算范围）。
 * 红线：
 *  - contact_leads 表无 user_id，纯游客线索，不记录登录态。
 *  - dataTypes 以 Json 数组入库；可选字段未填则存 null。
 *  - BigInt 主键统一在 VM 层转 number。
 */
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CONTACT_BUDGETS,
  CONTACT_DATA_TYPES,
  CONTACT_SCENES,
  CONTACT_STAGES,
  ContactOptions,
} from './contact.constants';
import { CreateLeadDto } from './dto/create-lead.dto';
import { LeadReceiptVm, toLeadReceiptVm } from './contact.vm';

@Injectable()
export class ContactService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 提交联系线索（POST /api/contact/leads）。
   * status 固定 new；dataTypes 以 Json 数组入库；可选字段未填存 null。
   */
  async createLead(dto: CreateLeadDto): Promise<LeadReceiptVm> {
    const lead = await this.prisma.contactLead.create({
      data: {
        name: dto.name,
        contactWay: dto.contactWay,
        company: dto.company ?? null,
        email: dto.email ?? null,
        scene: dto.scene ?? null,
        // 多选数据类型以 Json 数组入库；未填时存空数组（与 schema 默认一致）
        dataTypes: (dto.dataTypes ?? []) as Prisma.InputJsonValue,
        stage: dto.stage ?? null,
        budget: dto.budget ?? null,
        message: dto.message ?? '',
        // status 不接收前端入参，由 schema 默认 LeadStatus.new 落库
      },
    });
    return toLeadReceiptVm(lead);
  }

  /**
   * 获取表单选项配置（GET /api/contact/options）。
   * 直接返回后端常量（与前端 ContactPage 文案逐字对齐）。
   */
  getOptions(): ContactOptions {
    return {
      scenes: [...CONTACT_SCENES],
      dataTypes: [...CONTACT_DATA_TYPES],
      stages: [...CONTACT_STAGES],
      budgets: [...CONTACT_BUDGETS],
    };
  }
}
