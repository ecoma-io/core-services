import { AggregateRoot, DomainEventEnvelope } from '@ecoma-io/domain';

export interface RoleState {
  roleId?: string;
  tenantId?: string;
  name?: string;
  description?: string;
  permissionKeys?: string[];
}

export class RoleAggregate extends AggregateRoot<RoleState> {
  constructor(private readonly _id?: string) {
    super();
    if (_id) this._state.roleId = _id;
  }

  protected applyEvent(event: DomainEventEnvelope): void {
    switch (event.type) {
      case 'RoleCreated':
        this._state.roleId = (event.payload as any).roleId || event.aggregateId;
        this._state.tenantId = (event.payload as any).tenantId;
        this._state.name = (event.payload as any).name;
        this._state.permissionKeys =
          (event.payload as any).permissionKeys || [];
        break;
      default:
        break;
    }
  }

  create(
    roleId: string,
    tenantId: string,
    name: string,
    permissionKeys: string[]
  ) {
    const ev: DomainEventEnvelope = {
      id: `${Date.now()}-${Math.random()}`,
      type: 'RoleCreated',
      aggregateId: this._id ?? roleId,
      occurredAt: new Date().toISOString(),
      eventVersion: '1.0.0',
      payload: { roleId, tenantId, name, permissionKeys },
      metadata: {},
    };
    this.recordEvent(ev);
  }
}
