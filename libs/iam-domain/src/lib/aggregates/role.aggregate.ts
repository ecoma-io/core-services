import { AggregateRoot, DomainEventEnvelope } from '@ecoma-io/domain';
import { v7 as uuidv7 } from 'uuid';

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
      case 'RoleUpdated':
        if ((event.payload as any).name !== undefined) {
          this._state.name = (event.payload as any).name;
        }
        if ((event.payload as any).description !== undefined) {
          this._state.description = (event.payload as any).description;
        }
        break;
      case 'PermissionsAssigned':
        this._state.permissionKeys = Array.from(
          new Set([
            ...(this._state.permissionKeys || []),
            ...((event.payload as any).permissionKeys || []),
          ])
        );
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
      id: uuidv7(),
      type: 'RoleCreated',
      aggregateId: this._id ?? roleId,
      occurredAt: new Date().toISOString(),
      eventVersion: '1.0.0',
      payload: { roleId, tenantId, name, permissionKeys },
      metadata: {},
    };
    this.recordEvent(ev);
  }

  updateRole(name?: string, description?: string) {
    const payload: any = {};
    if (name !== undefined) payload.name = name;
    if (description !== undefined) payload.description = description;

    const ev: DomainEventEnvelope = {
      id: uuidv7(),
      type: 'RoleUpdated',
      aggregateId: this._state.roleId as string,
      occurredAt: new Date().toISOString(),
      eventVersion: '1.0.0',
      payload,
      metadata: {},
    };
    this.recordEvent(ev);
  }

  assignPermissions(permissionKeys: string[]) {
    const ev: DomainEventEnvelope = {
      id: uuidv7(),
      type: 'PermissionsAssigned',
      aggregateId: this._state.roleId as string,
      occurredAt: new Date().toISOString(),
      eventVersion: '1.0.0',
      payload: { permissionKeys },
      metadata: {},
    };
    this.recordEvent(ev);
  }
}
