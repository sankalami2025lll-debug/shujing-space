/**
 * DTO：后台训练数据服务申请列表查询入参
 * 接口：GET /api/admin/training-applications（仅 admin）
 * 字段：
 *  - status：申请状态过滤（TrainingStatus：submitted/contacted/evaluating/quoted/closed）
 *  - keyword：关键词（联系人 / 公司 / 联系方式，contains，不区分大小写）
 *  - page / pageSize：分页（继承 PaginationDto）
 */
import { ApiPropertyOptional } from '@nestjs/swagger';
import { TrainingStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class QueryAdminTrainingDto extends PaginationDto {
  // 申请状态过滤
  @ApiPropertyOptional({ description: '申请状态过滤', enum: TrainingStatus })
  @IsOptional()
  @IsEnum(TrainingStatus, {
    message: 'status 必须为 submitted/contacted/evaluating/quoted/closed 之一',
  })
  status?: TrainingStatus;

  // 关键词（联系人 / 公司 / 联系方式）
  @ApiPropertyOptional({ description: '关键词（联系人 / 公司 / 联系方式）' })
  @IsOptional()
  @IsString({ message: 'keyword 必须为字符串' })
  @MaxLength(120, { message: 'keyword 长度不能超过 120' })
  keyword?: string;
}
