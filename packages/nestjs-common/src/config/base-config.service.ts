import { ClassConstructor, Transform } from 'class-transformer';
import { validateConfig } from './validate-config';
import {
  IsEnum,
  IsOptional,
  IsInt,
  Min,
  Max,
  IsNotEmpty,
  IsString,
  IsArray,
  IsBoolean,
} from 'class-validator';
import { StandardizedTracerConfig } from '@ecoma-io/node-observability';
import { expandEnv } from './expand-env';

export enum AppEnvironment {
  Development = 'development',
  Test = 'test',
  Staging = 'staging',
  Production = 'production',
}

export class BaseProcessEnvironment {
  @IsEnum(AppEnvironment)
  @IsOptional()
  NODE_ENV: AppEnvironment;

  @IsInt()
  @Min(0)
  @Max(65535)
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  APP_PORT: number;

  @IsNotEmpty()
  @IsOptional()
  APP_HOST: string;

  @IsString()
  OTEL_ENDPOINT: string;

  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  OTEL_METRICS_ENABLED: boolean;

  @IsInt()
  @Min(0)
  @Max(65535)
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  OTEL_METRICS_PORT: number;

  @IsArray()
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.split(',') : value
  )
  OTEL_HEADERS?: string[];

  @IsOptional()
  @IsInt()
  @Min(1)
  @Transform(({ value }) => parseInt(value, 10))
  OTEL_BATCH_PROCESS_MAX_QUEUE_SIZE?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Transform(({ value }) => parseInt(value, 10))
  OTEL_BATCH_PROCESS_MAX_EXPORT_BATCH_SIZE?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Transform(({ value }) => parseInt(value, 10))
  OTEL_BATCH_PROCESS_SCHEDULED_DELAY_MILLIS?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Transform(({ value }) => parseInt(value, 10))
  OTEL_BATCH_PROCESS_EXPORT_TIMEOUT_MILLIS?: number;
}

/**
 * @remarks Base class for configuration services that handles expansion and validation of environment variables.
 * It ensures environment variables are processed once per application lifecycle using a static property.
 * @template T - The type of the validated configuration object, extending a plain object.
 */
export abstract class BaseConfigService<T extends BaseProcessEnvironment> {
  private static environments: unknown;

  /**
   * @remarks Initializes the configuration service by expanding and validating environment variables if not already done.
   * Uses a static property to cache the validated environments across instances.
   * @param processEnvironmentValidator - The class constructor used to validate the environment configuration.
   * @throws Will throw an error if validation fails, as handled by `validateConfig`.
   */
  constructor(processEnvironmentValidator: ClassConstructor<T>) {
    if (!BaseConfigService.environments) {
      const env = expandEnv(process.env as Record<string, string>);
      BaseConfigService.environments = validateConfig<T>(
        env,
        processEnvironmentValidator
      );
    }
  }

  public get appPort(): number {
    return this.environments.APP_PORT || 3000;
  }

  public get appHost(): string {
    return this.environments.APP_HOST || '0.0.0.0';
  }

  public get appEnvName(): AppEnvironment {
    return this.environments.NODE_ENV || AppEnvironment.Production;
  }

  public get otelTracerConfig(): Omit<
    StandardizedTracerConfig,
    'serviceName' | 'serviceVersion'
  > {
    return {
      environment: this.appEnvName,
      otlpEndpoint: this.environments.OTEL_ENDPOINT,
      otlpHeaders: this.environments.OTEL_HEADERS
        ? this.environments.OTEL_HEADERS.reduce(
            (acc, header) => {
              const [key, value] = header.split(':');
              acc[key.trim()] = value.trim();
              return acc;
            },
            {} as Record<string, string>
          )
        : undefined,
      metrics: {
        enabled: this.environments.OTEL_METRICS_ENABLED || true,
        metricsPort: this.environments.OTEL_METRICS_PORT || 9464,
      },
      batchProcessMaxQueueSize:
        this.environments.OTEL_BATCH_PROCESS_MAX_QUEUE_SIZE,
      batchProcessMaxExportBatchSize:
        this.environments.OTEL_BATCH_PROCESS_MAX_EXPORT_BATCH_SIZE,
      batchProcessScheduledDelayMillis:
        this.environments.OTEL_BATCH_PROCESS_SCHEDULED_DELAY_MILLIS,
      batchProcessExportTimeoutMillis:
        this.environments.OTEL_BATCH_PROCESS_EXPORT_TIMEOUT_MILLIS,
    };
  }

  /**
   * @remarks Retrieves the validated environment configuration object.
   * @returns The validated configuration object of type T.
   */
  protected get environments(): T {
    return BaseConfigService.environments as T;
  }
}
