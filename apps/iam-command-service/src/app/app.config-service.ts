import { Injectable } from '@nestjs/common';
import { BaseConfigService } from '@ecoma-io/nestjs-config';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  Min,
} from 'class-validator';

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

  @IsUrl({ require_protocol: true, protocols: ['esdb'] })
  @IsString()
  EVENTSTORE_CONNECTION_STRING!: string;

  @IsUrl({ require_protocol: true, protocols: ['amqp', 'amqps'] })
  @IsString()
  RABBITMQ_URI!: string;

  @IsString()
  @IsOptional()
  RABBITMQ_EXCHANGE!: string;

  @IsString()
  @IsOptional()
  RABBITMQ_EXCHANGE_TYPE!: 'topic' | 'direct' | 'fanout';
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
    return {
      connectionString: this.environments.EVENTSTORE_CONNECTION_STRING,
    };
  }

  /**
   * Retrieves the RabbitMQ configuration.
   * @returns {RabbitMQConfig} The RabbitMQ configuration object.
   */
  public getRabbitMQConfig(): RabbitMQConfig {
    return {
      uri: this.environments.RABBITMQ_URI,
      exchange: this.environments.RABBITMQ_EXCHANGE || 'iam.events',
      exchangeType: this.environments.RABBITMQ_EXCHANGE_TYPE || 'topic',
    };
  }
}
