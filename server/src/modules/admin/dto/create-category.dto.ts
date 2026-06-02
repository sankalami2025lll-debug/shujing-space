/**
 * DTO：后台新增分类入参
 * 接口：POST /api/admin/categories（仅 admin）
 * 字段（对应 categories 表）：
 *  - name：中文分类名（必填，≤40，唯一）
 *  - slug：英文标识（必填，≤40，唯一，仅小写字母/数字/连字符）
 *  - sort：排序权重（可选，默认 0）
 *  - isActive：是否启用（可选，默认 true）
 * 说明：name / slug 唯一冲突由 service 捕获 P2002 → 409。
 */
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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

export class CreateCategoryDto {
  // 中文分类名（必填，唯一）
  @ApiProperty({ description: '中文分类名', example: '实景三维' })
  @IsString({ message: 'name 必须为字符串' })
  @IsNotEmpty({ message: 'name 不能为空' })
  @MaxLength(40, { message: 'name 长度不能超过 40' })
  name!: string;

  // 英文标识（必填，唯一，仅小写字母 / 数字 / 连字符）
  @ApiProperty({ description: '英文标识（slug）', example: 'reality-3d' })
  @IsString({ message: 'slug 必须为字符串' })
  @IsNotEmpty({ message: 'slug 不能为空' })
  @MaxLength(40, { message: 'slug 长度不能超过 40' })
  @Matches(/^[a-z0-9-]+$/, {
    message: 'slug 仅允许小写字母、数字与连字符',
  })
  slug!: string;

  // 排序权重（可选，默认 0）
  @ApiPropertyOptional({ description: '排序权重', default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'sort 必须为整数' })
  @Min(0, { message: 'sort 不能为负数' })
  sort?: number;

  // 是否启用（可选，默认 true）
  @ApiPropertyOptional({ description: '是否启用', default: true })
  @IsOptional()
  @IsBoolean({ message: 'isActive 必须为布尔值' })
  isActive?: boolean;
}
