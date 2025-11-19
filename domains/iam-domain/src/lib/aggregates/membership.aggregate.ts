import { AggregateRoot } from '@ecoma-io/domain';
import { AddedUserToTenantEvent } from '../events/membership.events';

export class MembershipAggregate extends AggregateRoot {
  private userId?: string;
  private tenantId?: string;
  private roleIds: string[] = [];

  constructor(id?: string) {
    super(id);
  }

  public static addUser(props: {
    id?: string;
    userId: string;
    tenantId: string;
  }) {
    const m = new MembershipAggregate(props.id);
    m.userId = props.userId;
    m.tenantId = props.tenantId;
    m.addDomainEvent(
      new AddedUserToTenantEvent({
        aggregateId: m.id,
        version: '1.0.0',
        payload: {
          membershipId: m.id,
          userId: props.userId,
          tenantId: props.tenantId,
        },
      })
    );
    return m;
  }
}
