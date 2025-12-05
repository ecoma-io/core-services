import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
// eslint-disable-next-line no-restricted-syntax
import { HttpException as NestHttpException } from '@nestjs/common';
import { IErrorResponse } from '@ecoma-io/common';
import { HttpException } from '../exceptions';

/**
 * GlobalExceptionsFilter is a Catch-all filter for handling exceptions across the entire application.
 * The @Catch() decorator with no arguments makes it intercept every kind of exception.
 * This ensures that all errors, whether from NestJS, custom errors, or unhandled exceptions,
 * are formatted consistently before being returned to the client.
 */
@Catch()
export class GlobalExceptionsFilter implements ExceptionFilter {
  // Logger instance for logging exceptions that are caught by this filter.
  private readonly logger = new Logger(GlobalExceptionsFilter.name);

  // Inject HttpAdapterHost to gain access to the underlying HTTP server framework's response methods (e.g., Express or Fastify).
  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  /**
   * Main method to handle the caught exception.
   * @param exception The exception object that was thrown.
   * @param host An ArgumentsHost object providing access to method arguments (like request and response objects).
   */
  catch(exception: unknown, host: ArgumentsHost): void {
    // Resolve the httpAdapter from the host, which is necessary to manually send the response.
    const { httpAdapter } = this.httpAdapterHost;

    // Get the request context and switch to HTTP context to access response objects.
    const ctx = host.switchToHttp();

    let httpStatus: number;
    // Define the standardized response body structure (assuming ErrorResponse is a standard interface used across the app).
    // The response may be undefined when an exception does not provide a structured response.
    let response: IErrorResponse<unknown, unknown> | undefined;

    // 1. Handle standard NestJS exceptions (e.g., BadRequestException, NotFoundException)
    if (exception instanceof NestHttpException) {
      httpStatus = exception.getStatus();
      response = {
        message: exception.message,
      };
      // 2. Handle custom application-specific HttpExceptions
    } else if (exception instanceof HttpException) {
      // Custom exceptions are expected to have a getStatus() and getResponse() method.
      httpStatus = exception.getStatus();
      // Use provided structured response when available; otherwise fall back to a simple message.
      response = exception.getResponse() ?? {
        message: (exception as Error)?.message ?? 'Error',
      };
    } else {
      // 3. Handle all other unexpected/unhandled exceptions (fallback to Internal Server Error)
      httpStatus = HttpStatus.INTERNAL_SERVER_ERROR;
      response = { message: 'Internal Server Error' };
    }

    // Log the full exception for debugging purposes (this includes stack trace).
    this.logger.error(
      exception,
      ...(exception instanceof Error ? exception.stack : '')
    );

    // Ensure we always send an object as the response body.
    const body = response ?? { message: 'Internal Server Error' };
    // Send the structured response back to the client using the underlying HTTP adapter.
    httpAdapter.reply(ctx.getResponse(), body, httpStatus);
  }
}
