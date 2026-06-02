/**
 * DTO：后台批量更新站点配置入参
 * 接口：PUT /api/admin/site-config（仅 admin）
 * 结构：{ items: [{ key, value }, ...] }
 *  - key：对外字段名，必须在白名单 SITE_CONFIG_FIELDS 内（phone/email/address/icp/companyName/footerText）
 *  - value：配置值（字符串，长度上限按 service 内各字段定义校验；此处统一兜底 ≤500）
 * 说明：
 *  - 仅允许更新白名单字段，杜绝任意键注入。
 *  - items 至少 1 项、至多 20 项。
 *  - 各字段精确长度上限在 service 内按 SITE_CONFIG_FIELD_DEFS 二次校验。
 */
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { SITE_CONFIG_FIELDS } from '../site-config.constants';

// 单条配置项（key/value）
export class SiteConfigItemDto {
  // 配置项键（必须为白名单对外字段名）
  @ApiProperty({ description: '配置项键', enum: SITE_CONFIG_FIELDS })
  @IsString({ message: 'key 必须为字符串' })
  @IsIn(SITE_CONFIG_FIELDS, {
    message: `key 必须为 ${SITE_CONFIG_FIELDS.join('/')} 之一`,
  })
  key!: string;

  // 配置项值（统一兜底长度 ≤500，精确上限由 service 二次校验）
  @ApiProperty({ description: '配置项值' })
  @IsString({ message: 'value 必须为字符串' })
  @MaxLength(500, { message: 'value 长度不能超过 500' })
  value!: string;
}

export class UpdateSiteConfigDto {
  // 批量配置项（至少 1 项，至多 20 项）
  @ApiProperty({ description: '批量配置项', type: [SiteConfigItemDto] })
  @IsArray({ message: 'items 必须为数组' })
  @ArrayMinSize(1, { message: 'items 至少需要 1 项' })
  @ArrayMaxSize(20, { message: 'items 数量不能超过 20' })
  @ValidateNested({ each: true })
  @Type(() => SiteConfigItemDto)
  items!: SiteConfigItemDto[];
}
