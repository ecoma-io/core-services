import { DomainEventEnvelope } from '@ecoma-io/domain';
import { v7 as uuidv7 } from 'uuid';

export function createServiceVersionRegisteredEvent(
  aggregateId: string,
  payload: { serviceId: string; version: string; permissionsTree: unknown }
): DomainEventEnvelope {
  return {
    id: uuidv7(),
    type: 'ServiceVersionRegistered',
    aggregateId,
    occurredAt: new Date().toISOString(),
    eventVersion: '1.0.0',
    payload,
    metadata: {},
  };
}
