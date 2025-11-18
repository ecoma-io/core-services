import { Injectable } from '@nestjs/common';
import { BaseConfigService } from '@ecoma-io/nestjs-config';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

/**
 * Enumeration of supported application environments.
 */
enum Environment {
  Development = 'development',
  Production = 'production',
  Staging = 'staging',
  Test = 'test',
}

/**
 * Application-level configuration interface.
 * Defines the structure for app-specific settings.
 */
export type AppConfig = {
  /** Current Node.js environment (e.g., 'development', 'production'). */
  nodeEnv: string;
  /** Host address for the application server. */
  host: string;
  /** Port number for the application server. */
  port: number;
};

/**
 * EventStoreDB configuration interface.
 */
export type EventStoreConfig = {
  /** EventStoreDB connection string */
  connectionString: string;
};

/**
 * RabbitMQ configuration interface.
 */
export type RabbitMQConfig = {
  /** RabbitMQ connection URI */
  uri: string;
  /** Exchange name for domain events */
  exchange: string;
  /** Exchange type */
  exchangeType: 'topic' | 'direct' | 'fanout';
  /** DLX configuration (Phase 4.4) */
  dlx?: {
    maxRetries?: number;
    retryDelay?: number;
    useExponentialBackoff?: boolean;
  };
};

/**
 * Database configuration interface.
 */
export type DatabaseConfig = {
  /** Database host */
  host: string;
  /** Database port */
  port: number;
  /** Database name */
  database: string;
  /** Database username */
  username: string;
  /** Database password */
  password: string;
};

/**
 * Validator class for process environment variables.
 * Uses class-validator decorators to enforce validation rules on environment variables.
 */
class ProcessEnvironmentValidator {
  @IsEnum(Environment)
  @IsOptional()
  NODE_ENV!: Environment;

  @IsInt()
  @Min(0)
  @Max(65535)
  @IsOptional()
  PORT!: number;

  @IsString()
  @IsOptional()
  HOST!: string;

  // EventStoreDB
  @IsString()
  @IsOptional()
  ESDB_HOST!: string;

  @IsInt()
  @Min(0)
  @Max(65535)
  @IsOptional()
  ESDB_PORT!: number;

  @IsString()
  @IsOptional()
  ESDB_USERNAME!: string;

  @IsString()
  @IsOptional()
  ESDB_PASSWORD!: string;

  @IsString()
  @IsOptional()
  EVENTSTORE_CONNECTION_STRING!: string; // fallback for e2e

  // RabbitMQ
  @IsString()
  @IsOptional()
  MQ_HOST!: string;

  @IsInt()
  @Min(0)
  @Max(65535)
  @IsOptional()
  MQ_PORT!: number;

  @IsString()
  @IsOptional()
  MQ_USERNAME!: string;

  @IsString()
  @IsOptional()
  MQ_PASSWORD!: string;

  @IsString()
  @IsOptional()
  MQ_EXCHANGE!: string;

  @IsString()
  @IsOptional()
  MQ_EXCHANGE_TYPE!: 'topic' | 'direct' | 'fanout';

  @IsString()
  @IsOptional()
  MQ_URI!: string; // fallback for e2e

  // DLX Configuration (Phase 4.4)
  @IsString()
  @IsOptional()
  DLX_MAX_RETRIES!: string;

  @IsString()
  @IsOptional()
  DLX_RETRY_DELAY!: string;

  @IsString()
  @IsOptional()
  DLX_USE_EXPONENTIAL_BACKOFF!: string;

  // PostgreSQL
  @IsString()
  @IsOptional()
  DB_HOST!: string;

  @IsInt()
  @Min(0)
  @Max(65535)
  @IsOptional()
  DB_PORT!: number;

  @IsString()
  @IsOptional()
  DB_USERNAME!: string;

  @IsString()
  DB_PASSWORD!: string;

  @IsString()
  DB_DATABASE!: string;

  // Redis
  @IsString()
  @IsOptional()
  CACHE_HOST!: string;

  @IsInt()
  @Min(0)
  @Max(65535)
  @IsOptional()
  CACHE_PORT!: number;

  @IsString()
  @IsOptional()
  CACHE_PASSWORD!: string;

  @IsInt()
  @Min(0)
  @Max(15)
  @IsOptional()
  CACHE_DB!: number;
}

/**
 * Service for managing IAM Command Service configuration.
 * Extends BaseConfigService to provide validated access to environment variables and derived configs.
 */
@Injectable()
export class AppConfigService extends BaseConfigService<ProcessEnvironmentValidator> {
  constructor() {
    super(ProcessEnvironmentValidator);
  }

  /**
   * Retrieves the application configuration.
   * @returns {AppConfig} The application configuration object.
   */
  public getAppConfig(): AppConfig {
    return {
      nodeEnv: this.environments.NODE_ENV || 'development',
      host: this.environments.HOST || '0.0.0.0',
      port: this.environments.PORT || 3001,
    };
  }

  /**
   * Retrieves the EventStoreDB configuration.
   * @returns {EventStoreConfig} The EventStore configuration object.
   */
  public getEventStoreConfig(): EventStoreConfig {
    // Ưu tiên connection string nếu có (e2e), nếu không thì build từ biến riêng
    if (this.environments.EVENTSTORE_CONNECTION_STRING) {
      return {
        connectionString: this.environments.EVENTSTORE_CONNECTION_STRING,
      };
    }
    const host = this.environments.ESDB_HOST || 'localhost';
    const port = this.environments.ESDB_PORT || 2113;
    const user = this.environments.ESDB_USERNAME;
    const pass = this.environments.ESDB_PASSWORD;
    // Nếu có user/pass thì thêm vào connection string
    let auth = '';
    if (user && pass) {
      auth = `${encodeURIComponent(user)}:${encodeURIComponent(pass)}@`;
    } else if (user) {
      auth = `${encodeURIComponent(user)}@`;
    }
    return {
      connectionString: `esdb://${auth}${host}:${port}`,
    };
  }

  /**
   * Retrieves the RabbitMQ configuration.
   * @returns {RabbitMQConfig} The RabbitMQ configuration object.
   */
  public getRabbitMQConfig(): RabbitMQConfig {
    // Ưu tiên connection string nếu có (e2e), nếu không thì build từ biến riêng
    if (this.environments.MQ_URI) {
      return {
        uri: this.environments.MQ_URI,
        exchange: this.environments.MQ_EXCHANGE || 'iam.events',
        exchangeType: this.environments.MQ_EXCHANGE_TYPE || 'topic',
        dlx: {
          maxRetries: parseInt(this.environments.DLX_MAX_RETRIES || '5', 10),
          retryDelay: parseInt(this.environments.DLX_RETRY_DELAY || '5000', 10),
          useExponentialBackoff:
            this.environments.DLX_USE_EXPONENTIAL_BACKOFF !== 'false',
        },
      };
    }
    const host = this.environments.MQ_HOST || 'localhost';
    const port = this.environments.MQ_PORT || 5672;
    const user = this.environments.MQ_USERNAME;
    const pass = this.environments.MQ_PASSWORD;
    // Có thể bổ sung vhost nếu service cần
    return {
      uri: `amqp://${user}:${pass}@${host}:${port}`,
      exchange: this.environments.MQ_EXCHANGE || 'iam.events',
      exchangeType: this.environments.MQ_EXCHANGE_TYPE || 'topic',
      dlx: {
        maxRetries: parseInt(this.environments.DLX_MAX_RETRIES || '5', 10),
        retryDelay: parseInt(this.environments.DLX_RETRY_DELAY || '5000', 10),
        useExponentialBackoff:
          this.environments.DLX_USE_EXPONENTIAL_BACKOFF !== 'false',
      },
    };
  }

  /**
   * Retrieves the database configuration.
   * @returns {DatabaseConfig} The database configuration object.
   */
  public getDatabaseConfig(): DatabaseConfig {
    return {
      host: this.environments.DB_HOST || 'localhost',
      port: this.environments.DB_PORT || 5432,
      database: this.environments.DB_DATABASE,
      username: this.environments.DB_USERNAME,
      password: this.environments.DB_PASSWORD,
    };
  }
}
