/**
 * 过滤器：全局异常统一处理
 * 用途：把抛出的异常统一转换为 { code, message, data:null } 响应，避免泄露堆栈、统一前端处理。
 * 触发：注册为全局异常过滤器（main.ts）。
 */
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

@Catch()
export class AllExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // 区分 HttpException 与未知异常，得到状态码与消息
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    let message = '服务器内部错误';
    if (exception instanceof HttpException) {
      const res = exception.getResponse();
      // NestException 的 message 可能是字符串或对象（含校验错误数组）
      if (typeof res === 'string') {
        message = res;
      } else if (typeof res === 'object' && res !== null) {
        const m = (res as Record<string, unknown>).message;
        message = Array.isArray(m) ? m.join('; ') : String(m ?? message);
      }
    }

    // 记录服务端日志（非 4xx 才记 error，便于排查）
    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${request.method} ${request.url} -> ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    // 错误码沿用 HTTP 状态码，便于排查
    response.status(status).json({
      code: status,
      message,
      data: null,
    });
  }
}
