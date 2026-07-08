/**
 * DTO：更新模型空间标注入参
 * 接口：PATCH /api/models/:modelId/annotations/:annotationId
 * 说明：所有字段可选；anchorPosition/anchorNormal 与 cameraSnapshot 一起更新（重新保存视角时前端会同时回传锚点）。
 */
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class UpdateAnnotationCameraSnapshotDto {
  @ApiPropertyOptional({ type: [Number] })
  @IsArray()
  @ArrayMinSize(3)
  @ArrayMaxSize(3)
  @IsNumber({ allowInfinity: false, allowNaN: false }, { each: true })
  position!: number[];

  @ApiPropertyOptional({ type: [Number] })
  @IsArray()
  @ArrayMinSize(3)
  @ArrayMaxSize(3)
  @IsNumber({ allowInfinity: false, allowNaN: false }, { each: true })
  target!: number[];

  @ApiPropertyOptional({ type: [Number] })
  @IsArray()
  @ArrayMinSize(3)
  @ArrayMaxSize(3)
  @IsNumber({ allowInfinity: false, allowNaN: false }, { each: true })
  up!: number[];

  @ApiPropertyOptional()
  @IsNumber({ allowInfinity: false, allowNaN: false })
  @Min(0)
  near!: number;

  @ApiPropertyOptional()
  @IsNumber({ allowInfinity: false, allowNaN: false })
  @Min(0)
  far!: number;
}

export class UpdateAnnotationDto {
  @ApiPropertyOptional({ description: '标题胶囊文案' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  @ApiPropertyOptional({ description: '文字描述' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: '锚点世界坐标 [x,y,z]', type: [Number] })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(3)
  @ArrayMaxSize(3)
  @IsNumber({ allowInfinity: false, allowNaN: false }, { each: true })
  anchorPosition?: number[];

  @ApiPropertyOptional({ description: '锚点法线 [x,y,z]', type: [Number] })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(3)
  @ArrayMaxSize(3)
  @IsNumber({ allowInfinity: false, allowNaN: false }, { each: true })
  anchorNormal?: number[];

  @ApiPropertyOptional({ description: '该标注对应视角（扁平结构）' })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => UpdateAnnotationCameraSnapshotDto)
  cameraSnapshot?: UpdateAnnotationCameraSnapshotDto;

  @ApiPropertyOptional({ description: '内容框屏幕偏移（预留）' })
  @IsOptional()
  @IsObject()
  displayOffset?: Record<string, unknown>;

  @ApiPropertyOptional({ description: '状态 active/hidden', enum: ['active', 'hidden'] })
  @IsOptional()
  @IsIn(['active', 'hidden'])
  status?: 'active' | 'hidden';

  @ApiPropertyOptional({ description: '排序权重' })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
