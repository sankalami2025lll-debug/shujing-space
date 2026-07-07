/**
 * 应用入口：main.ts
 * 用途：创建 Nest 应用并完成全局装配——
 *  - 全局路由前缀 /api
 *  - 全局校验管道 ValidationPipe（whitelist + transform）
 *  - 全局成功响应包装 TransformInterceptor
 *  - 全局异常过滤 AllExceptionFilter
 *  - CORS、Helmet 安全头
 *  - Swagger 文档（/api/docs，可由环境变量关闭）
 */
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AllExceptionFilter } from './common/filters/all-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

// BigInt JSON 序列化补丁：Prisma 主键为 BigInt，JSON.stringify 默认会抛错，
// 这里统一序列化为字符串，作为全局兜底（业务返回仍建议显式映射 id）。
(BigInt.prototype as unknown as { toJSON: () => string }).toJSON = function () {
  return this.toString();
};

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  // 全局路由前缀：所有接口以 /api 开头
  app.setGlobalPrefix('api');

  // 安全响应头
  app.use(helmet());

  // 反代 IP 信任：线上经 OpenResty / 1Panel 单层反代到容器，
  // 必须显式声明信任层数，express 才会取 X-Forwarded-For 中的真实客户端 IP 作为 req.ip。
  // 这里设为 1：仅信任最近一跳反代写入的 X-Forwarded-For 最右侧地址，
  // 不盲目信任多层 X-Forwarded-For，避免被伪造请求误导限流桶。
  // 影响：限流（@nestjs/throttler 默认按 req.ip）与健康检查/日志取到的 IP 更接近真实客户端。
  app.getHttpAdapter().getInstance().set('trust proxy', 1);

  // 跨域：仅允许配置的前端来源（数组）
  // 生产环境：必须使用配置的 CORS_ORIGIN（env.validation 已强制非空，不会 fallback true）
  // 开发环境：CORS_ORIGIN 为空时放通所有来源以方便调试（生产环境因校验拦截会阻止启动）
  const corsOrigins = config.get<string[]>('corsOrigins') ?? [];
  const isProduction = config.get<string>('nodeEnv') === 'production';
  app.enableCors({
    origin: isProduction ? corsOrigins : corsOrigins.length > 0 ? corsOrigins : true,
    credentials: true,
  });

  // 全局入参校验：剔除未声明字段、自动类型转换、未知字段报错
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // 全局成功响应包装与异常统一处理
  app.useGlobalInterceptors(new TransformInterceptor());
  app.useGlobalFilters(new AllExceptionFilter());

  // Swagger 文档（生产可通过 SWAGGER_ENABLED=false 关闭）
  if (config.get<boolean>('swaggerEnabled')) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('数境空间官网 API')
      .setDescription('数境空间官网后端接口文档')
      .setVersion('0.0.1')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);
  }

  // 优雅关闭：容器停止时正确断开数据库等连接
  app.enableShutdownHooks();

  const port = config.get<number>('port') ?? 4000;
  await app.listen(port, '0.0.0.0');
  // 启动日志
  // eslint-disable-next-line no-console
  console.log(`后端已启动：http://localhost:${port}/api`);
}

void bootstrap();
