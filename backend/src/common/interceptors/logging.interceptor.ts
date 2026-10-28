import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const { method, url, ip } = req;
    const userId = req.user?.id || 'anonymous';
    const start = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const res = context.switchToHttp().getResponse();
          const duration = Date.now() - start;
          this.logger.log(`${method} ${url} ${res.statusCode} ${duration}ms — user:${userId} ip:${ip}`);
        },
        error: (err) => {
          const duration = Date.now() - start;
          this.logger.warn(`${method} ${url} ${err.status || 500} ${duration}ms — user:${userId}`);
        },
      }),
    );
  }
}
