import { BaseProjector } from '../lib/base-projector';
import { DomainEventEnvelope } from '@ecoma-io/domain';
import { EntityManager } from 'typeorm';
import { DataSource } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { RabbitMqAdapter } from '../lib/adapters/rabbitmq-adapter';
import { CheckpointRepositoryImpl } from '../lib/checkpoint.repository';
import { UpcasterRegistryImpl } from '../lib/upcaster.registry';
@Injectable()
export class TenantProjector extends BaseProjector {
  constructor(
    broker: RabbitMqAdapter,
    ds: DataSource,
    checkpoint: CheckpointRepositoryImpl,
    upcasters: UpcasterRegistryImpl
  ) {
    super(broker, ds, checkpoint, upcasters, 'TenantProjector');
  }

  protected async apply(
    envelope: DomainEventEnvelope,
    manager: EntityManager
  ): Promise<void> {
    switch (envelope.type) {
      case 'TenantCreated': {
        const { name, namespace, metadata } = envelope.payload as any;
        await manager.query(
          `INSERT INTO tenants_read_model (tenant_id, name, namespace, metadata, created_at)
           VALUES ($1, $2, $3, $4, now()) ON CONFLICT (tenant_id) DO NOTHING`,
          [
            envelope.aggregateId,
            name,
            namespace,
            metadata ? JSON.stringify(metadata) : null,
          ]
        );
        break;
      }
      case 'TenantUpdated': {
        const { name, metadata } = envelope.payload as any;
        const updates: string[] = [];
        const values: any[] = [];
        let paramIndex = 2;

        if (name !== undefined) {
          updates.push(`name = $${paramIndex++}`);
          values.push(name);
        }
        if (metadata !== undefined) {
          updates.push(`metadata = $${paramIndex++}`);
          values.push(JSON.stringify(metadata));
        }

        if (updates.length > 0) {
          updates.push(`updated_at = now()`);
          await manager.query(
            `UPDATE tenants_read_model SET ${updates.join(', ')} WHERE tenant_id = $1`,
            [envelope.aggregateId, ...values]
          );
        }
        break;
      }
      default:
        // ignore
        break;
    }
  }
}
