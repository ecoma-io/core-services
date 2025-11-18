/**
 * @ecoma-io/nestjs-observability
 *
 * @remarks
 * Zero-config observability for NestJS applications.
 * Provides Pino-based logging and OpenTelemetry tracing
 * with environment-based configuration using class-validator.
 *
 * @packageDocumentation
 */
// ============================================================================
// Health check exports
// ============================================================================
export { HealthCheckModule } from './lib/health/health-check.module';
export { HealthCheckService } from './lib/health/health-check.service';
export { HealthCheckController } from './lib/health/health-check.controller';
