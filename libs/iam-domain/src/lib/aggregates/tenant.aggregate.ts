import { AggregateRoot, DomainEventEnvelope } from '@ecoma-io/domain';

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
      default:
        break;
    }
  }

  create(name: string, namespace: string, metadata?: Record<string, unknown>) {
    const ev: DomainEventEnvelope = {
      id: `${Date.now()}-${Math.random()}`,
      type: 'TenantCreated',
      aggregateId: this._id ?? (this._state.tenantId as string) ?? '',
      occurredAt: new Date().toISOString(),
      eventVersion: '1.0.0',
      payload: { name, namespace, metadata },
      metadata: {},
    };
    this.recordEvent(ev);
  }
}
