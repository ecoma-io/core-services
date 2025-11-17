import { AggregateRoot, DomainEventEnvelope } from '@ecoma-io/domain';

export interface ApplicationState {
  clientId?: string;
  name?: string;
  clientSecretHash?: string;
}

export class ApplicationAggregate extends AggregateRoot<ApplicationState> {
  constructor(private readonly _id?: string) {
    super();
    if (_id) this._state.clientId = _id;
  }

  protected applyEvent(event: DomainEventEnvelope): void {
    switch (event.type) {
      case 'ApplicationRegistered':
        this._state.clientId =
          (event.payload as any).clientId || event.aggregateId;
        this._state.name = (event.payload as any).name;
        this._state.clientSecretHash = (event.payload as any).clientSecretHash;
        break;
      default:
        break;
    }
  }

  register(clientId: string, name: string, clientSecretHash?: string) {
    const ev: DomainEventEnvelope = {
      id: `${Date.now()}-${Math.random()}`,
      type: 'ApplicationRegistered',
      aggregateId: this._id ?? clientId,
      occurredAt: new Date().toISOString(),
      eventVersion: '1.0.0',
      payload: { clientId, name, clientSecretHash },
      metadata: {},
    };
    this.recordEvent(ev);
  }
}
