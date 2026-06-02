/**
 * 控制器：AuthController
 * 用途：暴露 /api/auth/* 认证接口。
 * 接口：
 *  - POST /api/auth/send-code      发送验证码（开发环境返回 devCode）
 *  - POST /api/auth/register       注册（注册即登录）
 *  - POST /api/auth/login          登录（密码 / 验证码）
 *  - POST /api/auth/reset-password 找回 / 重置密码
 *  - GET  /api/auth/me             当前登录用户（需 Bearer Token）
 *  - POST /api/auth/logout         退出登录（access-only，无状态，由前端删 token）
 */
import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { VerificationScene } from '@prisma/client';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { SendCodeDto } from './dto/send-code.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AuthUser } from './jwt-payload.interface';
import { VerificationService } from './verification.service';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly verification: VerificationService,
  ) {}

  // POST /api/auth/send-code：发送验证码（注册/登录/找回共用）
  // 双层限频：
  //  1) IP 限流（本装饰器）：同一 IP 60s 内最多 5 次，超限返回 429「请求过于频繁，请稍后再试」。
  //  2) 业务限频（VerificationService）：同一 target+scene 60s 内仅一次，仍然保留。
  // 仅本路由挂 ThrottlerGuard，不影响 login/register/me 等其它接口。
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @UseGuards(ThrottlerGuard)
  @Post('send-code')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '发送验证码（开发环境返回 devCode；同一 IP 60s 限 5 次）' })
  async sendCode(@Body() dto: SendCodeDto) {
    const result = await this.verification.sendCode(
      dto.target,
      dto.scene as VerificationScene,
    );
    return { sent: true, ...result };
  }

  // POST /api/auth/register：注册并直接返回登录态
  @Post('register')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '用户注册（手机/邮箱 + 验证码 + 密码 + 协议）' })
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  // POST /api/auth/login：密码或验证码登录
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '用户登录（密码 / 验证码）' })
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  // POST /api/auth/reset-password：找回 / 重置密码
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '找回 / 重置密码（验证码校验）' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  // GET /api/auth/me：当前登录用户（需 Bearer Token）
  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取当前登录用户' })
  async me(@CurrentUser() user: AuthUser) {
    return this.authService.getMe(user.id);
  }

  // POST /api/auth/logout：退出登录（无状态，仅提示前端删除 token）
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '退出登录（access-only，由前端删除 token）' })
  logout() {
    return { loggedOut: true };
  }
}
