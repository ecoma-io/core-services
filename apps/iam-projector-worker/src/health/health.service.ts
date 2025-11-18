import { Injectable } from '@nestjs/common';

@Injectable()
export class HealthService {
  liveness(): string {
    return 'OK';
  }
  readiness(): string {
    // TODO: check DB, RabbitMQ, Redis connection
    return 'READY';
  }
}
