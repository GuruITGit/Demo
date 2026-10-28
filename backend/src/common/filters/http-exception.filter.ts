import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    let message = 'เกิดข้อผิดพลาดภายในระบบ';
    let code = 'INTERNAL_SERVER_ERROR';
    let details = null;

    if (exception instanceof HttpException) {
      const exceptionResponse = exception.getResponse();
      if (typeof exceptionResponse === 'object') {
        const res = exceptionResponse as any;
        message = res.message || exception.message;
        code = res.error || this.getErrorCode(status);
        details = Array.isArray(res.message) ? res.message : null;
        if (details) message = 'ข้อมูลไม่ถูกต้อง';
      } else {
        message = exceptionResponse as string;
        code = this.getErrorCode(status);
      }
    }

    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.url} — ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
      // Expose actual error in non-production for debugging
      if (process.env.NODE_ENV !== 'production') {
        message = exception instanceof Error ? exception.message : String(exception);
      }
    }

    response.status(status).json({
      success: false,
      error: {
        code,
        message,
        ...(details && { details: details.map(this.formatValidationError) }),
      },
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }

  private formatValidationError(msg: string | object) {
    if (typeof msg === 'string') return { message: msg };
    return msg;
  }

  private getErrorCode(status: number): string {
    const codes: Record<number, string> = {
      400: 'BAD_REQUEST',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      409: 'CONFLICT',
      422: 'UNPROCESSABLE_ENTITY',
      429: 'TOO_MANY_REQUESTS',
      500: 'INTERNAL_SERVER_ERROR',
    };
    return codes[status] || 'ERROR';
  }
}
