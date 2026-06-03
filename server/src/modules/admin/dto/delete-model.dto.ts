/**
 * DTO：后台软删除模型入参
 * 接口：DELETE /api/admin/models/:id（仅 admin）
 * 字段：
 *  - deleteReason：删除原因，可选；若传入则必须为非空字符串，长度 ≤500
 */
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class DeleteModelDto {
  @ApiPropertyOptional({ description: '删除原因（可选）', maxLength: 500 })
  @IsOptional()
  @IsString({ message: 'deleteReason 必须为字符串' })
  @IsNotEmpty({ message: 'deleteReason 不能为空' })
  @MaxLength(500, { message: 'deleteReason 长度不能超过 500' })
  deleteReason?: string;
}
