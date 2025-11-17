import { DomainEventEnvelope } from '@ecoma-io/domain';
import { v7 as uuidv7 } from 'uuid';

export function createTenantCreatedEvent(
  aggregateId: string,
  payload: { name: string; namespace: string }
): DomainEventEnvelope {
  return {
    id: uuidv7(),
    type: 'TenantCreated',
    aggregateId,
    occurredAt: new Date().toISOString(),
    eventVersion: '1.0.0',
    payload,
    metadata: {},
  };
}
