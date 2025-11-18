import { Injectable } from '@nestjs/common';
import { BaseConfigService } from '@ecoma-io/nestjs-config';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

enum Environment {
  Development = 'development',
  Production = 'production',
  Staging = 'staging',
  Test = 'test',
}

class WorkerEnvValidator {
  @IsEnum(Environment)
  @IsOptional()
  NODE_ENV!: Environment;

  @IsString()
  @IsOptional()
  MQ_HOST!: string;
  @IsInt() @Min(0) @Max(65535) @IsOptional() MQ_PORT!: number;
  @IsString() @IsOptional() MQ_USERNAME!: string;
  @IsString() @IsOptional() MQ_PASSWORD!: string;
  @IsString() @IsOptional() MQ_EXCHANGE!: string;
  @IsString() @IsOptional() MQ_EXCHANGE_TYPE!: 'topic' | 'direct' | 'fanout';
  @IsString() @IsOptional() MQ_URI!: string;

  @IsString() @IsOptional() DB_HOST!: string;
  @IsInt() @Min(0) @Max(65535) @IsOptional() DB_PORT!: number;
  @IsString() @IsOptional() DB_USERNAME!: string;
  @IsString() @IsOptional() DB_PASSWORD!: string;
  @IsString() @IsOptional() DB_DATABASE!: string;
}

export type RabbitMQConfig = {
  uri: string;
  exchange: string;
  exchangeType: 'topic' | 'direct' | 'fanout';
};
export type DatabaseConfig = {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
};

@Injectable()
export class AppConfigService extends BaseConfigService<WorkerEnvValidator> {
  constructor() {
    super(WorkerEnvValidator);
  }

  getRabbitMQConfig(): RabbitMQConfig {
    if (this.environments.MQ_URI) {
      return {
        uri: this.environments.MQ_URI,
        exchange: this.environments.MQ_EXCHANGE || 'iam.events',
        exchangeType: this.environments.MQ_EXCHANGE_TYPE || 'topic',
      };
    }
    const host = this.environments.MQ_HOST || 'localhost';
    const port = this.environments.MQ_PORT || 5672;
    const user = this.environments.MQ_USERNAME || 'guest';
    const pass = this.environments.MQ_PASSWORD || 'guest';
    return {
      uri: `amqp://${user}:${pass}@${host}:${port}`,
      exchange: this.environments.MQ_EXCHANGE || 'iam.events',
      exchangeType: this.environments.MQ_EXCHANGE_TYPE || 'topic',
    };
  }

  getDatabaseConfig(): DatabaseConfig {
    return {
      host: this.environments.DB_HOST || 'localhost',
      port: this.environments.DB_PORT || 5432,
      database: this.environments.DB_DATABASE || 'iam-write',
      username: this.environments.DB_USERNAME || 'postgres',
      password: this.environments.DB_PASSWORD || 'postgres',
    };
  }
}
