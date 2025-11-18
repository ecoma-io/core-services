import { AggregateRoot, DomainEventEnvelope } from '@ecoma-io/domain';
import { v7 as uuidv7 } from 'uuid';

export interface MembershipState {
  membershipId?: string;
  userId?: string;
  tenantId?: string;
  roleIds?: string[];
}

export class MembershipAggregate extends AggregateRoot<MembershipState> {
  constructor(private readonly _id?: string) {
    super();
    if (_id) this._state.membershipId = _id;
  }

  protected applyEvent(event: DomainEventEnvelope): void {
    switch (event.type) {
      case 'UserAddedToTenant':
        this._state.membershipId =
          (event.payload as any).membershipId || event.aggregateId;
        this._state.userId = (event.payload as any).userId;
        this._state.tenantId = (event.payload as any).tenantId;
        this._state.roleIds = [];
        break;
      case 'RoleAssignedToUser':
        this._state.roleIds = Array.from(
          new Set([
            ...(this._state.roleIds || []),
            (event.payload as any).roleId,
          ])
        );
        break;
      case 'RoleRemovedFromUser':
        this._state.roleIds = (this._state.roleIds || []).filter(
          (id) => id !== (event.payload as any).roleId
        );
        break;
      default:
        break;
    }
  }

  addToTenant(membershipId: string, userId: string, tenantId: string) {
    const ev: DomainEventEnvelope = {
      id: uuidv7(),
      type: 'UserAddedToTenant',
      aggregateId: this._id ?? membershipId,
      occurredAt: new Date().toISOString(),
      eventVersion: '1.0.0',
      payload: { membershipId, userId, tenantId },
      metadata: {},
    };
    this.recordEvent(ev);
  }

  assignRole(roleId: string) {
    const ev: DomainEventEnvelope = {
      id: uuidv7(),
      type: 'RoleAssignedToUser',
      aggregateId: this._state.membershipId as string,
      occurredAt: new Date().toISOString(),
      eventVersion: '1.0.0',
      payload: { roleId },
      metadata: {},
    };
    this.recordEvent(ev);
  }

  removeRole(roleId: string) {
    const ev: DomainEventEnvelope = {
      id: uuidv7(),
      type: 'RoleRemovedFromUser',
      aggregateId: this._state.membershipId as string,
      occurredAt: new Date().toISOString(),
      eventVersion: '1.0.0',
      payload: { roleId },
      metadata: {},
    };
    this.recordEvent(ev);
  }
}
