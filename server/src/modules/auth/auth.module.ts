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
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from './guards/optional-jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { TokenService } from './token.service';
import { VerificationService } from './verification.service';
import { SmsModule } from '../sms/sms.module';

// 从 JwtModuleOptions 推导出 expiresIn 的精确可接受类型（number | StringValue）
type ExpiresInValue = NonNullable<JwtModuleOptions['signOptions']>['expiresIn'];

@Module({
  imports: [
    // 限流说明：ThrottlerModule.forRoot 与 APP_GUARD=ThrottlerGuard 已上移到 AppModule 全局注册，
    //           本模块不再重复注册。send-code 接口通过 @Throttle({default:{limit:5,ttl:60000}})
    //           覆盖全局默认 60/min/IP，由全局 APP_GUARD 接管执行，无需本模块再挂 ThrottlerGuard。
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
    SmsModule,
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
