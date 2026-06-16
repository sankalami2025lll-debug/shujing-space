import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateModelDto {
  @ApiPropertyOptional({ description: '模型名称', example: '新名称' })
  @IsOptional()
  @IsString({ message: 'title 必须为字符串' })
  @MaxLength(120, { message: 'title 长度不能超过 120' })
  title?: string;

  @ApiPropertyOptional({ description: '模型简介' })
  @IsOptional()
  @IsString({ message: 'description 必须为字符串' })
  @MaxLength(2000, { message: 'description 长度不能超过 2000' })
  description?: string;

  @ApiPropertyOptional({ description: '封面图片 URL' })
  @IsOptional()
  @IsString({ message: 'coverUrl 必须为字符串' })
  @MaxLength(500, { message: 'coverUrl 长度不能超过 500' })
  coverUrl?: string;
}
