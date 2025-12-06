export const CORE_PRODUCT_REQUIRED_ENV_VARS = [
  'POSTGRES_PORT',
  'POSTGRES_USERNAME',
  'POSTGRES_PASSWORD',
  'REDIS_PORT',
  'REDIS_PASSWORD',
  'MINIO_PORT',
  'MINIO_KEY',
  'MINIO_SECRET',
  'MAILDEV_PORT',
  'MAILDEV_WEB_PORT',
  'MONGO_PORT',
  'MONGO_USERNAME',
  'MONGO_PASSWORD',
  'RABBITMQ_AMQP_PORT',
  'RABBITMQ_USERNAME',
  'RABBITMQ_PASSWORD',
  'RABBITMQ_MANAGEMENT_PORT',
  'ESDB_HTTP_PORT',
  'ELASTIC_PORT',
  'ELASTIC_PASSWORD',
  'HYPERDX_API_KEY',
  'HYPERDX_OLTP_HTTP_PORT',
  'CLICK_HOUSE_HTTP_PORT',
  'CLICK_HOUSE_TCP_PORT',
  'CLICK_HOUSE_USER',
  'CLICK_HOUSE_PASSWORD',
];

export function validateEnvVars(): void {
  for (const envVar of CORE_PRODUCT_REQUIRED_ENV_VARS) {
    if (process.env[envVar] === undefined) {
      throw new Error(`Environment variable ${envVar} is required but not set`);
    }
  }
}
