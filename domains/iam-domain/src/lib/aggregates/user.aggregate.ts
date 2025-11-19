import { AggregateRoot } from '@ecoma-io/domain';
import { UserRegisteredEvent } from '../events/user.events';

export class UserAggregate extends AggregateRoot {
  private email?: string;
  private firstName?: string;
  private lastName?: string;

  constructor(id?: string, email?: string) {
    super(id);
    if (email) this.email = email;
  }

  public static register(props: {
    id?: string;
    email: string;
    passwordHash: string;
    firstName?: string;
    lastName?: string;
    source?: string;
  }) {
    const user = new UserAggregate(props.id, props.email);
    user.firstName = props.firstName;
    user.lastName = props.lastName;

    user.addDomainEvent(
      new UserRegisteredEvent({
        aggregateId: user.id,
        version: '1.0.0',
        payload: {
          email: props.email,
          passwordHash: props.passwordHash,
          firstName: props.firstName,
          lastName: props.lastName,
          source: props.source,
        },
      })
    );

    return user;
  }
}
