import { BaseProjector } from '../lib/base-projector';
import { DomainEventEnvelope } from '@ecoma-io/domain';
import { EntityManager, DataSource } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { RabbitMqAdapter } from '../lib/adapters/rabbitmq-adapter';
import { CheckpointRepositoryImpl } from '../lib/checkpoint.repository';
import { UpcasterRegistryImpl } from '../lib/upcaster.registry';

/**
 * MembershipProjector
 *
 * Projects membership domain events to memberships_read_model table.
 * Handles:
 * - UserAddedToTenant: Creates membership record (user-tenant link)
 * - RoleAssignedToUser: Adds role to roleIds array
 * - RoleRemovedFromUser: Removes role from roleIds array (if event exists)
 *
 * @see ADR-3: Read Your Own Writes (RYOW) pattern with checkpoint tracking
 * @see ADR-4: Event-driven projection with transactional consistency
 */
@Injectable()
export class MembershipProjector extends BaseProjector {
  constructor(
    broker: RabbitMqAdapter,
    ds: DataSource,
    checkpoint: CheckpointRepositoryImpl,
    upcasters: UpcasterRegistryImpl
  ) {
    super(broker, ds, checkpoint, upcasters, 'MembershipProjector');
  }

  protected async apply(
    envelope: DomainEventEnvelope,
    manager: EntityManager
  ): Promise<void> {
    switch (envelope.type) {
      case 'UserAddedToTenant': {
        const { membershipId, userId, tenantId } = envelope.payload as {
          membershipId: string;
          userId: string;
          tenantId: string;
        };
        await manager.query(
          `INSERT INTO memberships_read_model (membership_id, user_id, tenant_id, role_ids, created_at)
           VALUES ($1, $2, $3, '[]'::jsonb, now())
           ON CONFLICT (membership_id) DO NOTHING`,
          [membershipId, userId, tenantId]
        );
        break;
      }

      case 'RoleAssignedToUser': {
        const { roleId } = envelope.payload as { roleId: string };
        // Append roleId to roleIds array if not already present (use jsonb operators)
        await manager.query(
          `UPDATE memberships_read_model
           SET role_ids = CASE
             WHEN role_ids @> $2::jsonb THEN role_ids
             ELSE role_ids || $2::jsonb
           END,
           updated_at = now()
           WHERE membership_id = $1`,
          [envelope.aggregateId, JSON.stringify([roleId])]
        );
        break;
      }

      case 'RoleRemovedFromUser': {
        const { roleId } = envelope.payload as { roleId: string };
        // Remove roleId from roleIds array (use jsonb operators)
        await manager.query(
          `UPDATE memberships_read_model
           SET role_ids = (
             SELECT jsonb_agg(elem)
             FROM jsonb_array_elements(role_ids) elem
             WHERE elem::text != $2
           ),
           updated_at = now()
           WHERE membership_id = $1`,
          [envelope.aggregateId, JSON.stringify(roleId)]
        );
        break;
      }

      default:
        // ignore unknown events
        break;
    }
  }
}
