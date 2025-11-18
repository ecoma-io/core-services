import { AggregateRoot, DomainEventEnvelope } from '@ecoma-io/domain';
import { v7 as uuidv7 } from 'uuid';

export interface TenantState {
  tenantId?: string;
  name?: string;
  namespace?: string;
  metadata?: Record<string, unknown>;
}

export class TenantAggregate extends AggregateRoot<TenantState> {
  constructor(private readonly _id?: string) {
    super();
    if (_id) this._state.tenantId = _id;
  }

  protected applyEvent(event: DomainEventEnvelope): void {
    switch (event.type) {
      case 'TenantCreated':
        this._state.tenantId = event.aggregateId;
        this._state.name = (event.payload as any).name;
        this._state.namespace = (event.payload as any).namespace;
        break;
      case 'TenantUpdated':
        if ((event.payload as any).name !== undefined) {
          this._state.name = (event.payload as any).name;
        }
        if ((event.payload as any).metadata !== undefined) {
          this._state.metadata = (event.payload as any).metadata;
        }
        break;
      default:
        break;
    }
  }

  create(name: string, namespace: string, metadata?: Record<string, unknown>) {
    const ev: DomainEventEnvelope = {
      id: uuidv7(),
      type: 'TenantCreated',
      aggregateId: this._id ?? (this._state.tenantId as string) ?? '',
      occurredAt: new Date().toISOString(),
      eventVersion: '1.0.0',
      payload: { name, namespace, metadata },
      metadata: {},
    };
    this.recordEvent(ev);
  }

  updateTenant(name?: string, metadata?: Record<string, unknown>) {
    const payload: any = {};
    if (name !== undefined) payload.name = name;
    if (metadata !== undefined) payload.metadata = metadata;

    const ev: DomainEventEnvelope = {
      id: uuidv7(),
      type: 'TenantUpdated',
      aggregateId: this._state.tenantId as string,
      occurredAt: new Date().toISOString(),
      eventVersion: '1.0.0',
      payload,
      metadata: {},
    };
    this.recordEvent(ev);
  }
}
