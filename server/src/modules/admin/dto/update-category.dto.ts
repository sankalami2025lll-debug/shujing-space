/**
 * DTO：后台编辑分类入参
 * 接口：PUT /api/admin/categories/:id（仅 admin）
 * 字段（全部可选，至少传一项由 service 校验；语义同 CreateCategoryDto）：
 *  - name / slug / sort / isActive
 * 说明：
 *  - isActive=false 即「停用」，作为被引用分类的软下架手段（替代删除）。
 *  - name / slug 唯一冲突由 service 捕获 P2002 → 409。
 */
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdateCategoryDto {
  // 中文分类名（可选）
  @ApiPropertyOptional({ description: '中文分类名' })
  @IsOptional()
  @IsString({ message: 'name 必须为字符串' })
  @IsNotEmpty({ message: 'name 不能为空字符串' })
  @MaxLength(40, { message: 'name 长度不能超过 40' })
  name?: string;

  // 英文标识（可选，仅小写字母 / 数字 / 连字符）
  @ApiPropertyOptional({ description: '英文标识（slug）' })
  @IsOptional()
  @IsString({ message: 'slug 必须为字符串' })
  @IsNotEmpty({ message: 'slug 不能为空字符串' })
  @MaxLength(40, { message: 'slug 长度不能超过 40' })
  @Matches(/^[a-z0-9-]+$/, {
    message: 'slug 仅允许小写字母、数字与连字符',
  })
  slug?: string;

  // 排序权重（可选）
  @ApiPropertyOptional({ description: '排序权重' })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'sort 必须为整数' })
  @Min(0, { message: 'sort 不能为负数' })
  sort?: number;

  // 是否启用（可选）
  @ApiPropertyOptional({ description: '是否启用' })
  @IsOptional()
  @IsBoolean({ message: 'isActive 必须为布尔值' })
  isActive?: boolean;
}
