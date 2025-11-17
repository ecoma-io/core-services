import { AggregateRoot, DomainEventEnvelope } from '@ecoma-io/domain';

export interface ServiceDefinitionState {
  serviceId?: string;
  name?: string;
  versions?: Array<{ version: string; permissionsTree: unknown }>;
}

export class ServiceDefinitionAggregate extends AggregateRoot<ServiceDefinitionState> {
  constructor(private readonly _id?: string) {
    super();
    if (_id) this._state.serviceId = _id;
  }

  protected applyEvent(event: DomainEventEnvelope): void {
    switch (event.type) {
      case 'ServiceVersionRegistered':
        this._state.serviceId =
          (event.payload as any).serviceId || event.aggregateId;
        this._state.versions = this._state.versions || [];
        this._state.versions.push({
          version: (event.payload as any).version,
          permissionsTree: (event.payload as any).permissionsTree,
        });
        break;
      default:
        break;
    }
  }

  registerVersion(
    serviceId: string,
    version: string,
    permissionsTree: unknown
  ) {
    const ev: DomainEventEnvelope = {
      id: `${Date.now()}-${Math.random()}`,
      type: 'ServiceVersionRegistered',
      aggregateId: this._id ?? serviceId,
      occurredAt: new Date().toISOString(),
      eventVersion: '1.0.0',
      payload: { serviceId, version, permissionsTree },
      metadata: {},
    };
    this.recordEvent(ev);
  }
}
