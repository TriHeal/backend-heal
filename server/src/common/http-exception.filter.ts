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
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    const isHttpException = exception instanceof HttpException;

    const status = isHttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const message = isHttpException
      ? exception.getResponse()
      : 'Internal server error';

    if (!isHttpException) {
      const error =
        exception instanceof Error
          ? exception
          : new Error(String(exception));

      this.logger.error(
        `${request.method} ${request.url}: ${error.message}`,
        error.stack,
      );
    }

    response.status(status).json({
      error:
        typeof message === 'string'
          ? message
          : (message as { message?: unknown }).message,
      details: typeof message === 'object' ? message : undefined,
    });
  }
}