import { registerAs } from '@nestjs/config';
import * as Joi from 'joi';

export default registerAs('app', () => ({
  databaseUrl: process.env.DATABASE_URL,
  rabbitmqUrl: process.env.RABBITMQ_URL,
  redisUrl: process.env.REDIS_URL,
}));

export const appConfigValidation = Joi.object({
  DATABASE_URL: Joi.string().uri().required(),
  RABBITMQ_URL: Joi.string().uri().required(),
  REDIS_URL: Joi.string().uri().required(),
});
