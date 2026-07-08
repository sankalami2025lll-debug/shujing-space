/**
 * 控制器：AnnotationsController
 * 用途：暴露模型空间热点标注接口（均挂载在 /api/models/:modelId/annotations 下）：
 *  - GET    /api/models/:modelId/annotations            列出标注（可选登录；作者全量，其余仅 active）
 *  - POST   /api/models/:modelId/annotations            新增标注（需登录 + owner）
 *  - PATCH  /api/models/:modelId/annotations/:annotationId  更新标注（需登录 + owner）
 *  - DELETE /api/models/:modelId/annotations/:annotationId  删除标注（需登录 + owner）
 *  - POST   /api/models/:modelId/annotations/:annotationId/media       新增媒体（需登录 + owner）
 *  - DELETE /api/models/:modelId/annotations/:annotationId/media/:mediaId  删除媒体（需登录 + owner）
 * 说明：响应体由全局 TransformInterceptor 统一包成 { code, message, data }，此处只返回业务数据。
 */
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { AuthUser } from '../auth/jwt-payload.interface';
import { CreateAnnotationDto } from './dto/create-annotation.dto';
import { UpdateAnnotationDto } from './dto/update-annotation.dto';
import { CreateAnnotationMediaDto } from './dto/create-annotation-media.dto';
import { AnnotationsService } from './annotations.service';

@ApiTags('annotations')
@Controller('models/:modelId/annotations')
export class AnnotationsController {
  constructor(private readonly annotationsService: AnnotationsService) {}

  // GET：列出标注（游客/登录均可读 active；作者可读 active+hidden）
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '列出模型空间标注（作者全量；其余仅 active）' })
  async list(
    @CurrentUser() user: AuthUser | undefined,
    @Param('modelId', ParseIntPipe) modelId: number,
  ) {
    return this.annotationsService.list(BigInt(modelId), user?.id);
  }

  // POST：新增标注（仅 owner）
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post()
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '新增模型空间标注（仅模型归属用户）' })
  async create(
    @CurrentUser() user: AuthUser,
    @Param('modelId', ParseIntPipe) modelId: number,
    @Body() dto: CreateAnnotationDto,
  ) {
    return this.annotationsService.create(BigInt(modelId), user.id, dto);
  }

  // PATCH：更新标注（仅 owner）
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Patch(':annotationId')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '更新模型空间标注（仅模型归属用户）' })
  async update(
    @CurrentUser() user: AuthUser,
    @Param('modelId', ParseIntPipe) modelId: number,
    @Param('annotationId', ParseIntPipe) annotationId: number,
    @Body() dto: UpdateAnnotationDto,
  ) {
    return this.annotationsService.update(
      BigInt(modelId),
      BigInt(annotationId),
      user.id,
      dto,
    );
  }

  // DELETE：删除标注（仅 owner）
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Delete(':annotationId')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '删除模型空间标注（仅模型归属用户）' })
  async remove(
    @CurrentUser() user: AuthUser,
    @Param('modelId', ParseIntPipe) modelId: number,
    @Param('annotationId', ParseIntPipe) annotationId: number,
  ) {
    return this.annotationsService.remove(
      BigInt(modelId),
      BigInt(annotationId),
      user.id,
    );
  }

  // POST：新增媒体（仅 owner）
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post(':annotationId/media')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '为标注新增媒体（仅模型归属用户；V1 仅图片）' })
  async addMedia(
    @CurrentUser() user: AuthUser,
    @Param('modelId', ParseIntPipe) modelId: number,
    @Param('annotationId', ParseIntPipe) annotationId: number,
    @Body() dto: CreateAnnotationMediaDto,
  ) {
    return this.annotationsService.addMedia(
      BigInt(modelId),
      BigInt(annotationId),
      user.id,
      dto,
    );
  }

  // DELETE：删除媒体（仅 owner）
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Delete(':annotationId/media/:mediaId')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '删除标注媒体（仅模型归属用户）' })
  async removeMedia(
    @CurrentUser() user: AuthUser,
    @Param('modelId', ParseIntPipe) modelId: number,
    @Param('annotationId', ParseIntPipe) annotationId: number,
    @Param('mediaId', ParseIntPipe) mediaId: number,
  ) {
    return this.annotationsService.removeMedia(
      BigInt(modelId),
      BigInt(annotationId),
      BigInt(mediaId),
      user.id,
    );
  }
}
