/**
 * DTO：新增模型空间标注入参
 * 接口：POST /api/models/:modelId/annotations
 * 字段：
 *  - title：标题胶囊文案（必填）
 *  - description：文字描述（可空）
 *  - anchorPosition：[x,y,z] 模型世界坐标（render 空间，由前端 raycast 锁定）
 *  - anchorNormal：[x,y,z] 法线（可空，V1 不强制）
 *  - cameraSnapshot：该标注对应视角（复用 ModelLaunchView 结构）
 *  - displayOffset：内容框屏幕偏移（可空，预留）
 *  - status：active / hidden（可空，默认 active）
 *  - sortOrder：排序权重（可空，默认 0）
 */
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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

class AnnotationVector3Dto {
  @ApiProperty({ example: [1.2, 3.4, 5.6], type: [Number] })
  @IsArray({ message: '向量必须为长度为 3 的数组' })
  @ArrayMinSize(3, { message: '向量必须为长度为 3 的数组' })
  @ArrayMaxSize(3, { message: '向量必须为长度为 3 的数组' })
  @IsNumber(
    { allowInfinity: false, allowNaN: false },
    { each: true, message: '向量必须全部为数字' },
  )
  value!: number[];
}

class AnnotationCameraSnapshotDto {
  @ApiProperty({ example: [0, 2, 6], type: [Number] })
  @IsArray()
  @ArrayMinSize(3)
  @ArrayMaxSize(3)
  @IsNumber(
    { allowInfinity: false, allowNaN: false },
    { each: true },
  )
  position!: number[];

  @ApiProperty({ example: [0, 2, 0], type: [Number] })
  @IsArray()
  @ArrayMinSize(3)
  @ArrayMaxSize(3)
  @IsNumber(
    { allowInfinity: false, allowNaN: false },
    { each: true },
  )
  target!: number[];

  @ApiProperty({ example: [0, 1, 0], type: [Number] })
  @IsArray()
  @ArrayMinSize(3)
  @ArrayMaxSize(3)
  @IsNumber(
    { allowInfinity: false, allowNaN: false },
    { each: true },
  )
  up!: number[];

  @ApiProperty({ example: 0.1 })
  @IsNumber({ allowInfinity: false, allowNaN: false })
  @Min(0)
  near!: number;

  @ApiProperty({ example: 5000 })
  @IsNumber({ allowInfinity: false, allowNaN: false })
  @Min(0)
  far!: number;
}

export class CreateAnnotationDto {
  @ApiProperty({ description: '标题胶囊文案' })
  @IsString({ message: 'title 必须为字符串' })
  @MaxLength(120, { message: 'title 长度不能超过 120' })
  title!: string;

  @ApiPropertyOptional({ description: '文字描述' })
  @IsOptional()
  @IsString({ message: 'description 必须为字符串' })
  description?: string;

  @ApiProperty({ description: '锚点世界坐标 [x,y,z]', type: [Number] })
  @IsArray({ message: 'anchorPosition 必须为长度为 3 的数组' })
  @ArrayMinSize(3, { message: 'anchorPosition 必须为长度为 3 的数组' })
  @ArrayMaxSize(3, { message: 'anchorPosition 必须为长度为 3 的数组' })
  @IsNumber(
    { allowInfinity: false, allowNaN: false },
    { each: true, message: 'anchorPosition 必须全部为数字' },
  )
  anchorPosition!: number[];

  @ApiPropertyOptional({ description: '锚点法线 [x,y,z]', type: [Number] })
  @IsOptional()
  @IsArray({ message: 'anchorNormal 必须为长度为 3 的数组' })
  @ArrayMinSize(3, { message: 'anchorNormal 必须为长度为 3 的数组' })
  @ArrayMaxSize(3, { message: 'anchorNormal 必须为长度为 3 的数组' })
  @IsNumber(
    { allowInfinity: false, allowNaN: false },
    { each: true, message: 'anchorNormal 必须全部为数字' },
  )
  anchorNormal?: number[];

  @ApiProperty({
    description: '该标注对应视角（扁平结构：position/target/up 为长度 3 的数字数组，near/far 为数字）',
  })
  @IsObject({ message: 'cameraSnapshot 必须为对象' })
  @ValidateNested()
  @Type(() => AnnotationCameraSnapshotDto)
  cameraSnapshot!: AnnotationCameraSnapshotDto;

  @ApiPropertyOptional({ description: '内容框屏幕偏移（预留）' })
  @IsOptional()
  @IsObject({ message: 'displayOffset 必须为对象' })
  displayOffset?: Record<string, unknown>;

  @ApiPropertyOptional({ description: '状态 active/hidden', enum: ['active', 'hidden'] })
  @IsOptional()
  @IsIn(['active', 'hidden'], { message: 'status 必须为 active/hidden' })
  status?: 'active' | 'hidden';

  @ApiPropertyOptional({ description: '排序权重' })
  @IsOptional()
  @IsInt({ message: 'sortOrder 必须为整数' })
  @Min(0, { message: 'sortOrder 不能为负' })
  sortOrder?: number;
}
