import { AggregateRoot } from '@ecoma-io/domain';
import { RoleCreatedEvent } from '../events/role.events';

export class RoleAggregate extends AggregateRoot {
  private tenantId?: string;
  private name?: string;
  private permissionKeys: string[] = [];

  constructor(id?: string, tenantId?: string) {
    super(id);
    if (tenantId) this.tenantId = tenantId;
  }

  public static create(props: {
    id?: string;
    tenantId: string;
    name: string;
    permissionKeys?: string[];
  }) {
    const r = new RoleAggregate(props.id, props.tenantId);
    r.name = props.name;
    r.permissionKeys = props.permissionKeys ?? [];
    r.addDomainEvent(
      new RoleCreatedEvent({
        aggregateId: r.id,
        version: '1.0.0',
        payload: {
          roleId: r.id,
          tenantId: props.tenantId,
          name: props.name,
          permissionKeys: r.permissionKeys,
        },
      })
    );
    return r;
  }
}
