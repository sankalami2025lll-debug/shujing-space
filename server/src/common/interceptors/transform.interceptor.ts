/**
 * 拦截器：统一成功响应包装
 * 用途：把控制器返回的原始数据包装为 { code:0, message:'ok', data }，统一前端解析口径。
 * 触发：注册为全局拦截器（main.ts）。
 */
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiResponse, RESPONSE_CODE } from '../constants';

@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, ApiResponse<T>>
{
  intercept(
    _context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse<T>> {
    return next.handle().pipe(
      map((data) => ({
        code: RESPONSE_CODE.SUCCESS,
        message: 'ok',
        data,
      })),
    );
  }
}
