import { AggregateRoot } from '@ecoma-io/domain';
import { TenantCreatedEvent } from '../events/tenant.events';

export class TenantAggregate extends AggregateRoot {
  private name?: string;
  private namespace?: string;

  constructor(id?: string, name?: string, namespace?: string) {
    super(id);
    if (name) this.name = name;
    if (namespace) this.namespace = namespace;
  }

  public static create(props: {
    id?: string;
    name: string;
    namespace: string;
  }) {
    const t = new TenantAggregate(props.id, props.name, props.namespace);
    t.addDomainEvent(
      new TenantCreatedEvent({
        aggregateId: t.id,
        version: '1.0.0',
        payload: { name: props.name, namespace: props.namespace },
      })
    );
    return t;
  }
}
