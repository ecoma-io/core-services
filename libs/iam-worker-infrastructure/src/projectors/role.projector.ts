import { BaseProjector } from '../lib/base-projector';
import { DomainEventEnvelope } from '@ecoma-io/domain';
import { EntityManager, DataSource } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { RabbitMqAdapter } from '../lib/adapters/rabbitmq-adapter';
import { CheckpointRepositoryImpl } from '../lib/checkpoint.repository';
import { UpcasterRegistryImpl } from '../lib/upcaster.registry';

@Injectable()
export class RoleProjector extends BaseProjector {
  constructor(
    broker: RabbitMqAdapter,
    ds: DataSource,
    checkpoint: CheckpointRepositoryImpl,
    upcasters: UpcasterRegistryImpl
  ) {
    super(broker, ds, checkpoint, upcasters, 'RoleProjector');
  }

  protected async apply(
    envelope: DomainEventEnvelope,
    manager: EntityManager
  ): Promise<void> {
    switch (envelope.type) {
      case 'RoleCreated': {
        const payload = envelope.payload as {
          roleId: string;
          tenantId: string;
          name: string;
          permissionKeys?: string[];
        };
        await manager.query(
          `INSERT INTO roles_read_model (role_id, tenant_id, name, permission_keys, created_at, updated_at)
           VALUES ($1, $2, $3, $4, now(), now()) ON CONFLICT (role_id) DO NOTHING`,
          [
            payload.roleId,
            payload.tenantId,
            payload.name,
            JSON.stringify(payload.permissionKeys || []),
          ]
        );
        break;
      }
      case 'RoleUpdated': {
        const payload = envelope.payload as {
          name?: string;
          permissionKeys?: string[];
          description?: string;
        };
        const updates: string[] = [];
        const values: (string | object)[] = [];
        let paramIndex = 2;

        if (payload.name !== undefined) {
          updates.push(`name = $${paramIndex++}`);
          values.push(payload.name);
        }
        if (payload.permissionKeys !== undefined) {
          updates.push(`permission_keys = $${paramIndex++}`);
          values.push(JSON.stringify(payload.permissionKeys));
        }
        if (payload.description !== undefined) {
          updates.push(`description = $${paramIndex++}`);
          values.push(payload.description);
        }

        if (updates.length > 0) {
          updates.push(`updated_at = now()`);
          await manager.query(
            `UPDATE roles_read_model SET ${updates.join(', ')} WHERE role_id = $1`,
            [envelope.aggregateId, ...values]
          );
        }
        break;
      }
      case 'PermissionsAssigned': {
        const payload = envelope.payload as {
          permissionKeys: string[];
        };
        // Merge new permissions with existing ones (use jsonb to ensure uniqueness)
        await manager.query(
          `UPDATE roles_read_model
           SET permission_keys = (
             SELECT jsonb_agg(DISTINCT elem)
             FROM (
               SELECT elem FROM jsonb_array_elements(permission_keys)
               UNION
               SELECT elem FROM jsonb_array_elements($2::jsonb)
             ) AS combined(elem)
           ),
           updated_at = now()
           WHERE role_id = $1`,
          [envelope.aggregateId, JSON.stringify(payload.permissionKeys)]
        );
        break;
      }
      case 'RoleDeleted': {
        await manager.query(`DELETE FROM roles_read_model WHERE role_id = $1`, [
          envelope.aggregateId,
        ]);
        break;
      }
      default:
        // ignore
        break;
    }
  }
}
