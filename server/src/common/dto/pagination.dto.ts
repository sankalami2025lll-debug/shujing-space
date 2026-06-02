/**
 * 通用分页入参 DTO
 * 用途：列表类接口（如 /api/models）统一分页参数 page/pageSize。
 * 说明：本步先定义通用结构，供后续模块复用；字段含中文校验说明。
 */
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class PaginationDto {
  // 页码，从 1 开始，默认 1
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'page 必须为整数' })
  @Min(1, { message: 'page 最小为 1' })
  page: number = 1;

  // 每页条数，默认 12，最大 100，防止一次拉取过多
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'pageSize 必须为整数' })
  @Min(1, { message: 'pageSize 最小为 1' })
  @Max(100, { message: 'pageSize 最大为 100' })
  pageSize: number = 12;
}
