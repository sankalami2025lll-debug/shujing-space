/**
 * 模块：AuthModule
 * 用途：装配认证相关的 Controller / Service / Guard，配置 JWT。
 * 说明：
 *  - JwtModule 通过 registerAsync 从 ConfigService 读取密钥与有效期（来自环境变量）。
 *  - 导出 TokenService 与 Guards，供后续业务模块（模型/上传/后台等）复用登录态与权限校验。
 */
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from './guards/optional-jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { TokenService } from './token.service';
import { VerificationService } from './verification.service';

// 从 JwtModuleOptions 推导出 expiresIn 的精确可接受类型（number | StringValue）
type ExpiresInValue = NonNullable<JwtModuleOptions['signOptions']>['expiresIn'];

@Module({
  imports: [
    // 限流：仅为 send-code 接口提供 IP 限流能力（同一 IP 60s 内最多 5 次）。
    // 说明：此处只注册 throttler 配置与存储（内存），不注册全局 APP_GUARD，
    //       因此默认不影响其它接口；只有显式挂 @UseGuards(ThrottlerGuard) 的路由才限流。
    ThrottlerModule.forRoot({
      throttlers: [{ name: 'default', ttl: 60_000, limit: 5 }],
      // 超限统一返回中文提示（429，由全局异常过滤器包装为 {code,message,data}）
      errorMessage: '请求过于频繁，请稍后再试',
    }),
    // JWT：密钥与有效期来自环境变量（JWT_ACCESS_SECRET / JWT_ACCESS_EXPIRES）
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService): JwtModuleOptions => ({
        secret: config.get<string>('jwt.accessSecret'),
        // expiresIn 接受形如 '2h'/'30m' 的字符串；用 JwtModuleOptions 推导出的精确类型收口
        signOptions: {
          expiresIn: (config.get<string>('jwt.accessExpires') ??
            '2h') as ExpiresInValue,
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    VerificationService,
    TokenService,
    JwtAuthGuard,
    OptionalJwtAuthGuard,
    RolesGuard,
  ],
  exports: [TokenService, JwtAuthGuard, OptionalJwtAuthGuard, RolesGuard],
})
export class AuthModule {}
