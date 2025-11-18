import { BaseProjector } from '../lib/base-projector';
import { DomainEventEnvelope } from '@ecoma-io/domain';
import { EntityManager } from 'typeorm';

export class TenantProjector extends BaseProjector {
  protected projectorName = 'TenantProjector';

  protected async apply(
    envelope: DomainEventEnvelope,
    manager: EntityManager
  ): Promise<void> {
    switch (envelope.type) {
      case 'TenantCreated': {
        const { namespace, metadata } = envelope.payload as any;
        await manager.query(
          `INSERT INTO tenants_read_model (tenant_id, namespace, metadata, created_at)
           VALUES ($1, $2, $3, now()) ON CONFLICT (tenant_id) DO NOTHING`,
          [
            envelope.aggregateId,
            namespace,
            metadata ? JSON.stringify(metadata) : null,
          ]
        );
        break;
      }
      case 'TenantUpdated': {
        const { namespace, metadata } = envelope.payload as any;
        await manager.query(
          `UPDATE tenants_read_model SET namespace = $2, metadata = $3 WHERE tenant_id = $1`,
          [
            envelope.aggregateId,
            namespace,
            metadata ? JSON.stringify(metadata) : null,
          ]
        );
        break;
      }
      default:
        // ignore
        break;
    }
  }
}
