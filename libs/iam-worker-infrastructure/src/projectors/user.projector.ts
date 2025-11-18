import { BaseProjector } from '../lib/base-projector';
import { DomainEventEnvelope } from '@ecoma-io/domain';
import { EntityManager, DataSource } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { RabbitMqAdapter } from '../lib/adapters/rabbitmq-adapter';
import { CheckpointRepositoryImpl } from '../lib/checkpoint.repository';
import { UpcasterRegistryImpl } from '../lib/upcaster.registry';

@Injectable()
export class UserProjector extends BaseProjector {
  constructor(
    broker: RabbitMqAdapter,
    ds: DataSource,
    checkpoint: CheckpointRepositoryImpl,
    upcasters: UpcasterRegistryImpl
  ) {
    super(broker, ds, checkpoint, upcasters, 'UserProjector');
  }

  protected async apply(
    envelope: DomainEventEnvelope,
    manager: EntityManager
  ): Promise<void> {
    switch (envelope.type) {
      case 'UserRegistered': {
        const { email, firstName, lastName } = envelope.payload as any;
        await manager.query(
          `INSERT INTO users_read_model (user_id, email, first_name, last_name, created_at)
           VALUES ($1,$2,$3,$4,now()) ON CONFLICT (user_id) DO NOTHING`,
          [envelope.aggregateId, email, firstName || null, lastName || null]
        );
        break;
      }
      case 'UserPasswordChanged': {
        await manager.query(
          `UPDATE users_read_model SET password_changed_at = now() WHERE user_id = $1`,
          [envelope.aggregateId]
        );
        break;
      }
      case 'UserProfileUpdated': {
        const { firstName, lastName } = envelope.payload as any;
        await manager.query(
          `UPDATE users_read_model SET first_name = $2, last_name = $3, updated_at = now() WHERE user_id = $1`,
          [envelope.aggregateId, firstName || null, lastName || null]
        );
        break;
      }
      case 'UserStatusChanged': {
        const { status } = envelope.payload as any;
        await manager.query(
          `UPDATE users_read_model SET status = $2, updated_at = now() WHERE user_id = $1`,
          [envelope.aggregateId, status]
        );
        break;
      }
      default:
        // ignore
        break;
    }
  }
}
