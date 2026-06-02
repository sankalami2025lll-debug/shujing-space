/**
 * 服务：SiteConfigService
 * 用途：站点全站配置（Footer 联系方式 / 备案号 / 公司名 / 版权文案）的读取与维护：
 *  - getConfig：读取整形后的站点配置（公开 GET 与后台 GET 共用，缺失键回退默认值）。
 *  - updateConfig：后台批量 upsert 配置（白名单字段，事务内逐项写入）。
 * 红线：
 *  - 仅下发 / 更新白名单字段（SITE_CONFIG_FIELD_DEFS），杜绝任意键注入或泄露。
 *  - 各字段值长度按定义二次校验（DTO 已兜底 ≤500，此处精确收口）。
 */
import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SITE_CONFIG_DEF_BY_FIELD } from './site-config.constants';
import { UpdateSiteConfigDto } from './dto/update-site-config.dto';
import { SiteConfigVm, toSiteConfigVm } from './site-config.vm';

@Injectable()
export class SiteConfigService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 读取站点配置（GET /api/site-config、GET /api/admin/site-config 共用）。
   * 取全部行 → 按白名单整形为对外对象，缺失键回退默认值。
   */
  async getConfig(): Promise<SiteConfigVm> {
    const rows = await this.prisma.siteConfig.findMany();
    return toSiteConfigVm(rows);
  }

  /**
   * 批量更新站点配置（PUT /api/admin/site-config）。
   * 逐项：field → dbKey 映射 + 长度校验 → 事务内 upsert（存在更新、不存在创建）。
   * 同一 key 多次出现以最后一次为准（构造 map 去重）。
   */
  async updateConfig(dto: UpdateSiteConfigDto): Promise<SiteConfigVm> {
    // 1. 同 key 去重（后者覆盖前者）+ 按白名单映射 dbKey 并做长度校验
    const dbKeyToValue = new Map<string, string>();
    for (const item of dto.items) {
      const def = SITE_CONFIG_DEF_BY_FIELD.get(item.key);
      // key 已由 DTO @IsIn 限定，理论必命中；防御性兜底
      if (!def) {
        throw new BadRequestException(`不支持的配置项：${item.key}`);
      }
      if (item.value.length > def.maxLength) {
        throw new BadRequestException(
          `${item.key} 长度不能超过 ${def.maxLength}`,
        );
      }
      dbKeyToValue.set(def.dbKey, item.value);
    }

    // 2. 事务内逐项 upsert（幂等：存在更新值、不存在创建）
    await this.prisma.$transaction(
      Array.from(dbKeyToValue.entries()).map(([key, value]) =>
        this.prisma.siteConfig.upsert({
          where: { key },
          update: { value },
          create: { key, value },
        }),
      ),
    );

    // 3. 返回更新后的完整配置
    return this.getConfig();
  }
}
