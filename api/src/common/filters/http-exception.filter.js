import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';

/**
 * Normalizes every error response to one shape: { statusCode, message, error }.
 * class-validator's ValidationPipe throws HttpException with an array message
 * (one string per failed field) — that array is passed through as-is so the
 * frontend can show field-level errors.
 */
@Catch()
export class HttpExceptionFilter {
  constructor() {
    this.logger = new Logger('ExceptionFilter');
  }

  catch(exception, host) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse();
    const req = ctx.getRequest();

    const isHttp = exception instanceof HttpException;
    const status = isHttp ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const body = isHttp ? exception.getResponse() : null;

    const message = typeof body === 'string'
      ? body
      : body?.message || exception.message || 'Internal server error';

    if (!isHttp || status >= 500) {
      this.logger.error(`${req.method} ${req.url} -> ${status}: ${exception.message}`, exception.stack);
    }

    res.status(status).json({
      statusCode: status,
      message,
      error: body?.error || HttpStatus[status] || 'Error',
      path: req.url,
      timestamp: new Date().toISOString(),
    });
  }
}
