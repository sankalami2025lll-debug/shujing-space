/**
 * 控制器：UploadsController
 * 用途：暴露对象存储文件上传相关接口（均需登录）：
 *  - POST /api/uploads/presign   申请预签名直传地址（前端拿到后直传对象存储，文件不经服务器）
 *  - POST /api/uploads/callback  上传完成回执，登记 model_files 并返回可访问 URL
 * 说明：响应体由全局 TransformInterceptor 统一包成 { code, message, data }，此处只返回业务数据。
 */
import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthUser } from '../auth/jwt-payload.interface';
import { PresignDto } from './dto/presign.dto';
import { UploadCallbackDto } from './dto/upload-callback.dto';
import { UploadsService } from './uploads.service';

@ApiTags('uploads')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  // POST /api/uploads/presign：申请对象存储预签名上传地址（需登录）
  @Post('presign')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '申请对象存储预签名直传地址（前端直传，文件不经服务器）' })
  async presign(@CurrentUser() user: AuthUser, @Body() dto: PresignDto) {
    return this.uploadsService.presign(user.id, dto);
  }

  // POST /api/uploads/callback：上传完成回执（2G：须 HeadObject 确认对象已存在后才登记）
  @Post('callback')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      '上传完成回执（须对象已存在；size/mime 以 HeadObject 为准；失败不写 model_files）',
  })
  async callback(@CurrentUser() user: AuthUser, @Body() dto: UploadCallbackDto) {
    return this.uploadsService.callback(user.id, dto);
  }
}
