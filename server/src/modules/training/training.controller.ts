/**
 * 控制器：TrainingController
 * 用途：暴露训练数据服务申请接口（开发顺序第 8 步·阶段二）：
 *  - POST /api/training-applications      提交申请（游客/用户均可；登录则回填 userId）
 *  - GET  /api/training-applications/my   查询本人申请（需登录）
 * 说明：
 *  - POST 用 OptionalJwtAuthGuard：游客放行（userId=null），有效 Token 则解析挂 req.user 回填 userId。
 *  - GET /my 用 JwtAuthGuard：未登录 → 401；service 严格按 user.id 过滤，禁止越权。
 *  - 仅服务「具身智能机器人训练场景」申请，不扩展其它服务类型。
 *  - 响应体由全局 TransformInterceptor 统一包成 { code, message, data }。
 */
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { AuthUser } from '../auth/jwt-payload.interface';
import { CreateTrainingApplicationDto } from './dto/create-training-application.dto';
import { TrainingService } from './training.service';

@ApiTags('training-applications')
@Controller('training-applications')
export class TrainingController {
  constructor(private readonly trainingService: TrainingService) {}

  // POST /api/training-applications：提交申请（游客可提交；登录态自动回填 userId）
  @Post()
  @HttpCode(HttpStatus.OK)
  @UseGuards(OptionalJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '提交训练数据服务申请（游客/用户均可，status 固定 submitted）' })
  async create(
    @CurrentUser() user: AuthUser | undefined,
    @Body() dto: CreateTrainingApplicationDto,
  ) {
    return this.trainingService.createApplication(dto, user?.id ?? null);
  }

  // GET /api/training-applications/my：查询本人申请（需登录）
  @Get('my')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '我的训练数据服务申请（需登录，按创建时间倒序）' })
  async my(@CurrentUser() user: AuthUser, @Query() pagination: PaginationDto) {
    return this.trainingService.findMyApplications(user.id, pagination);
  }
}
