import { DomainEventEnvelope } from '@ecoma-io/domain';
import { v7 as uuidv7 } from 'uuid';

export function createRoleCreatedEvent(
  aggregateId: string,
  payload: {
    roleId: string;
    tenantId: string;
    name: string;
    permissionKeys: string[];
  }
): DomainEventEnvelope {
  return {
    id: uuidv7(),
    type: 'RoleCreated',
    aggregateId,
    occurredAt: new Date().toISOString(),
    eventVersion: '1.0.0',
    payload,
    metadata: {},
  };
}
