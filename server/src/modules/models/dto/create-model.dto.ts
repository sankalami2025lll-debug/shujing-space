/**
 * DTO：发布模型入参
 * 接口：POST /api/models（需登录）
 * 字段（对齐发布弹窗 UploadModal 与 models 表）：
 *  - title：模型名称（必填）
 *  - type：模型分类名（必填，服务端按 categories.name 反查 categoryId）
 *  - scenes：应用场景多选（可选）
 *  - description：模型简介（可选）
 *  - visibility：发布权限（public 公开 / private 仅自己 / review 审核后公开）
 *  - modelFileId：已上传模型文件 id（可选，来自 uploads/callback；反查得 modelUrl）
 *  - coverFileId：已上传封面文件 id（可选；反查得 coverUrl）
 *  - viewerUrl：外部 Viewer 链接（可选；与上传模型文件二选一，须 https）
 *  - viewerType：查看器来源（可选；缺省由服务端推断）
 *  - allowIframe：是否允许 iframe 内嵌（可选，默认 true）
 */
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ModelVisibility, ViewerType } from '@prisma/client';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
} from 'class-validator';

// 可见性枚举值（与 Prisma ModelVisibility 对应）
export const MODEL_VISIBILITIES = ['public', 'private', 'review'] as const;
// 查看器类型枚举值（与 Prisma ViewerType 对应）
export const VIEWER_TYPES = ['iframe', 'sketchfab', 'native', 'none'] as const;

export class CreateModelDto {
  // 模型名称
  @ApiProperty({ description: '模型名称', example: '古建筑实景三维模型' })
  @IsString({ message: 'title 必须为字符串' })
  @IsNotEmpty({ message: 'title 不能为空' })
  @MaxLength(120, { message: 'title 长度不能超过 120' })
  title!: string;

  // 模型分类名
  @ApiProperty({ description: '模型分类名', example: '实景三维' })
  @IsString({ message: 'type 必须为字符串' })
  @IsNotEmpty({ message: 'type 不能为空' })
  @MaxLength(40, { message: 'type 长度不能超过 40' })
  type!: string;

  // 应用场景多选
  @ApiPropertyOptional({ description: '应用场景多选', example: ['数字文旅', '沉浸展示'] })
  @IsOptional()
  @IsArray({ message: 'scenes 必须为数组' })
  @ArrayMaxSize(20, { message: 'scenes 最多 20 项' })
  @IsString({ each: true, message: 'scenes 每一项必须为字符串' })
  scenes?: string[];

  // 模型简介
  @ApiPropertyOptional({ description: '模型简介' })
  @IsOptional()
  @IsString({ message: 'description 必须为字符串' })
  @MaxLength(2000, { message: 'description 长度不能超过 2000' })
  description?: string;

  // 发布权限
  @ApiProperty({ description: '发布权限', enum: MODEL_VISIBILITIES, default: 'public' })
  @IsIn(MODEL_VISIBILITIES, { message: 'visibility 必须为 public/private/review 之一' })
  visibility: ModelVisibility = ModelVisibility.public;

  // 已上传模型文件 id
  @ApiPropertyOptional({ description: '已上传模型文件 id（uploads/callback 返回）' })
  @IsOptional()
  @IsInt({ message: 'modelFileId 必须为整数' })
  @Min(1, { message: 'modelFileId 非法' })
  modelFileId?: number;

  // 已上传封面文件 id
  @ApiPropertyOptional({ description: '已上传封面文件 id（uploads/callback 返回）' })
  @IsOptional()
  @IsInt({ message: 'coverFileId 必须为整数' })
  @Min(1, { message: 'coverFileId 非法' })
  coverFileId?: number;

  // 外部 Viewer 链接（与上传模型文件二选一）
  @ApiPropertyOptional({ description: '外部 Viewer 链接（https）' })
  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true }, { message: 'viewerUrl 必须为 https 链接' })
  @MaxLength(255, { message: 'viewerUrl 长度不能超过 255' })
  viewerUrl?: string;

  // 查看器来源（缺省由服务端推断）
  @ApiPropertyOptional({ description: '查看器来源', enum: VIEWER_TYPES })
  @IsOptional()
  @IsIn(VIEWER_TYPES, { message: 'viewerType 必须为 iframe/sketchfab/native/none 之一' })
  viewerType?: ViewerType;

  // 是否允许 iframe 内嵌
  @ApiPropertyOptional({ description: '是否允许 iframe 内嵌', default: true })
  @IsOptional()
  @IsBoolean({ message: 'allowIframe 必须为布尔值' })
  allowIframe?: boolean;
}
