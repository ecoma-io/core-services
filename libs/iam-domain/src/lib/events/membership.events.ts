import { DomainEventEnvelope } from '@ecoma-io/domain';
import { v7 as uuidv7 } from 'uuid';

export function createUserAddedToTenantEvent(
  aggregateId: string,
  payload: { membershipId: string; userId: string; tenantId: string }
): DomainEventEnvelope {
  return {
    id: uuidv7(),
    type: 'UserAddedToTenant',
    aggregateId,
    occurredAt: new Date().toISOString(),
    eventVersion: '1.0.0',
    payload,
    metadata: {},
  };
}
