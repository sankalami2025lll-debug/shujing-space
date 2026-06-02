/**
 * DTO：模型列表查询入参
 * 接口：GET /api/models
 * 字段：
 *  - type：按分类名过滤（匹配 models.type，如「实景三维」）；空或「全部模型」不过滤
 *  - keyword：关键词，匹配标题（不区分大小写）与作者昵称
 *  - sort：排序方式（latest 最新 / views 热门浏览 / favorites 最多收藏 / recommended 推荐）
 *  - page / pageSize：分页（继承 PaginationDto，page 默认 1、pageSize 默认 12、最大 100）
 * 说明：本 DTO 继承通用 PaginationDto，保持分页校验一致。
 */
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

// 模型列表排序方式枚举（英文契约，前端中文按钮在迁移时映射为此 key）
export const MODEL_SORTS = ['latest', 'views', 'favorites', 'recommended'] as const;
export type ModelSortValue = (typeof MODEL_SORTS)[number];

export class QueryModelsDto extends PaginationDto {
  // 分类名过滤：空或「全部模型」表示不过滤
  @ApiPropertyOptional({ description: '分类名（如 实景三维）；空或「全部模型」不过滤' })
  @IsOptional()
  @IsString({ message: 'type 必须为字符串' })
  @MaxLength(40, { message: 'type 长度不能超过 40' })
  type?: string;

  // 关键词：匹配标题与作者昵称
  @ApiPropertyOptional({ description: '关键词（匹配标题与作者昵称）' })
  @IsOptional()
  @IsString({ message: 'keyword 必须为字符串' })
  @MaxLength(60, { message: 'keyword 长度不能超过 60' })
  keyword?: string;

  // 排序方式：默认 latest（最新发布）
  @ApiPropertyOptional({ description: '排序方式', enum: MODEL_SORTS, default: 'latest' })
  @IsOptional()
  @IsIn(MODEL_SORTS, { message: 'sort 必须为 latest/views/favorites/recommended 之一' })
  sort: ModelSortValue = 'latest';
}
