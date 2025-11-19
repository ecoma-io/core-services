import { AggregateRoot } from '@ecoma-io/domain';
import { ServiceVersionRegisteredEvent } from '../events/service.events';

export class ServiceDefinitionAggregate extends AggregateRoot {
  private name?: string;
  private versions: Array<{ version: string; permissionsTree: unknown }> = [];

  constructor(id?: string, name?: string) {
    super(id);
    if (name) this.name = name;
  }

  public registerVersion(props: { version: string; permissionsTree: unknown }) {
    this.versions.push({
      version: props.version,
      permissionsTree: props.permissionsTree,
    });
    this.addDomainEvent(
      new ServiceVersionRegisteredEvent({
        aggregateId: this.id,
        version: '1.0.0',
        payload: {
          serviceId: this.id,
          version: props.version,
          permissionsTree: props.permissionsTree,
        },
      })
    );
  }
}
