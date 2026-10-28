import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface Response<T> {
  success: boolean;
  data: T;
  message?: string;
  meta?: any;
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, Response<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<Response<T>> {
    return next.handle().pipe(
      map((result) => {
        if (result && result.__raw) return result.data;

        if (result && result.data !== undefined && result.meta) {
          return {
            success: true,
            data: result.data,
            meta: result.meta,
            message: result.message || 'ดำเนินการสำเร็จ',
          };
        }

        return {
          success: true,
          data: result,
          message: 'ดำเนินการสำเร็จ',
        };
      }),
    );
  }
}
