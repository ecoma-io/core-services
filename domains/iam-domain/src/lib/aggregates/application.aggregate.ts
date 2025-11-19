import { AggregateRoot } from '@ecoma-io/domain';

export class ApplicationAggregate extends AggregateRoot {
  private name?: string;
  private clientId?: string;

  constructor(id?: string, name?: string) {
    super(id);
    if (name) this.name = name;
  }

  public register(props: { id?: string; clientId: string; name: string }) {
    this.clientId = props.clientId;
    this.name = props.name;
    // ApplicationRegistered event type is not present in this module's events yet.
    // When available, emit the event here using addDomainEvent(...)
    return this;
  }
}
