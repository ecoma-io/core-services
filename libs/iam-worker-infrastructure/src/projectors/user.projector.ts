import { BaseProjector } from '../lib/base-projector';
import { DomainEventEnvelope } from '@ecoma-io/domain';
import { EntityManager } from 'typeorm';

export class UserProjector extends BaseProjector {
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
      default:
        // ignore
        break;
    }
  }
}
