/**
 * 控制器：UploadTasksController
 * 用途：上传任务持久化 API（全部需登录），供后续前端刷新恢复任务卡使用。
 */
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthUser } from '../auth/jwt-payload.interface';
import { CreateUploadTaskDto } from './dto/create-upload-task.dto';
import { BindUploadTaskFileDto } from './dto/bind-upload-task-file.dto';
import { CompleteUploadTaskMultipartPartDto } from './dto/complete-upload-task-multipart-part.dto';
import {
  InitUploadTaskMultipartDto,
  UPLOAD_MULTIPART_KINDS,
} from './dto/init-upload-task-multipart.dto';
import { PresignUploadTaskMultipartPartsDto } from './dto/presign-upload-task-multipart-parts.dto';
import { VerifyUploadTaskMultipartFileDto } from './dto/verify-upload-task-multipart-file.dto';
import { UploadTaskMultipartService } from './upload-task-multipart.service';
import { QueryMyUploadTasksDto } from './dto/query-my-upload-tasks.dto';
import { UpdateUploadTaskStatusDto } from './dto/update-upload-task-status.dto';
import { UploadTasksService } from './upload-tasks.service';

@ApiTags('upload-tasks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('upload-tasks')
export class UploadTasksController {
  constructor(
    private readonly uploadTasksService: UploadTasksService,
    private readonly uploadTaskMultipartService: UploadTaskMultipartService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '创建上传任务（支持同用户同 clientToken 幂等）' })
  async create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateUploadTaskDto,
  ) {
    return this.uploadTasksService.createTask(user.id, dto);
  }

  @Get('me')
  @ApiOperation({ summary: '查询我的上传任务（status=incomplete/all）' })
  async myTasks(
    @CurrentUser() user: AuthUser,
    @Query() query: QueryMyUploadTasksDto,
  ) {
    return this.uploadTasksService.getMyTasks(user.id, query);
  }

  @Post(':id/status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '更新上传任务状态/阶段/错误快照（不允许客户端直接写 published）' })
  async updateStatus(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateUploadTaskStatusDto,
  ) {
    return this.uploadTasksService.updateTaskStatus(user.id, BigInt(id), dto);
  }

  @Post(':id/heartbeat')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '更新上传任务 heartbeat（仅 queued/running）' })
  async heartbeat(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.uploadTasksService.heartbeat(user.id, BigInt(id));
  }

  @Post(':id/files')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '绑定上传任务的 model/cover 文件（幂等，需校验归属）' })
  async bindFile(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: BindUploadTaskFileDto,
  ) {
    return this.uploadTasksService.bindFile(user.id, BigInt(id), dto);
  }

  @Post(':id/publish')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '根据任务快照和已绑定文件创建正式模型（复用 ModelsService.create）' })
  async publish(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.uploadTasksService.publish(user.id, BigInt(id));
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '取消上传任务（不删 OSS 对象/不删 model_files）' })
  async cancel(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.uploadTasksService.cancel(user.id, BigInt(id));
  }

  @Post(':id/interrupted')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '标记上传任务中断（供 beforeunload/sendBeacon 或后续前端调用）' })
  async interrupted(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.uploadTasksService.markInterrupted(user.id, BigInt(id));
  }

  @Post(':id/multipart/init')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '初始化 multipart 上传会话（幂等返回当前 current session）' })
  async initMultipart(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: InitUploadTaskMultipartDto,
  ) {
    return this.uploadTaskMultipartService.init(user.id, BigInt(id), dto);
  }

  @Get(':id/multipart/:kind')
  @ApiOperation({ summary: '获取当前 multipart 会话与 uploaded/missing parts 快照' })
  @ApiParam({ name: 'kind', enum: UPLOAD_MULTIPART_KINDS })
  async getMultipartSession(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Param('kind') kind: 'model' | 'cover',
  ) {
    return this.uploadTaskMultipartService.getCurrentSession(
      user.id,
      BigInt(id),
      kind,
    );
  }

  @Post(':id/multipart/:kind/verify-file')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '校验恢复上传时重新选择的文件是否与当前 multipart 会话一致' })
  @ApiParam({ name: 'kind', enum: UPLOAD_MULTIPART_KINDS })
  async verifyMultipartFile(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Param('kind') kind: 'model' | 'cover',
    @Body() dto: VerifyUploadTaskMultipartFileDto,
  ) {
    return this.uploadTaskMultipartService.verifyFile(
      user.id,
      BigInt(id),
      kind,
      dto,
    );
  }

  @Post(':id/multipart/:kind/parts/presign')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '批量申请 multipart 指定分片的预签名上传地址' })
  @ApiParam({ name: 'kind', enum: UPLOAD_MULTIPART_KINDS })
  async presignMultipartParts(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Param('kind') kind: 'model' | 'cover',
    @Body() dto: PresignUploadTaskMultipartPartsDto,
  ) {
    return this.uploadTaskMultipartService.presignParts(
      user.id,
      BigInt(id),
      kind,
      dto,
    );
  }

  @Post(':id/multipart/:kind/parts/:partNumber/complete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '登记 multipart 单个分片完成（保存 etag 并更新会话进度）' })
  @ApiParam({ name: 'kind', enum: UPLOAD_MULTIPART_KINDS })
  async completeMultipartPart(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Param('kind') kind: 'model' | 'cover',
    @Param('partNumber', ParseIntPipe) partNumber: number,
    @Body() dto: CompleteUploadTaskMultipartPartDto,
  ) {
    return this.uploadTaskMultipartService.completePart(
      user.id,
      BigInt(id),
      kind,
      partNumber,
      dto,
    );
  }

  @Post(':id/multipart/:kind/complete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '完成 multipart 上传并创建 model_files 绑定到 uploadTask' })
  @ApiParam({ name: 'kind', enum: UPLOAD_MULTIPART_KINDS })
  async completeMultipart(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Param('kind') kind: 'model' | 'cover',
  ) {
    return this.uploadTaskMultipartService.complete(
      user.id,
      BigInt(id),
      kind,
    );
  }

  @Post(':id/multipart/:kind/abort')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '中止 multipart 上传会话并标记 aborted' })
  @ApiParam({ name: 'kind', enum: UPLOAD_MULTIPART_KINDS })
  async abortMultipart(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Param('kind') kind: 'model' | 'cover',
  ) {
    return this.uploadTaskMultipartService.abort(user.id, BigInt(id), kind);
  }
}
