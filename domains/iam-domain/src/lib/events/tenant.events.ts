import { DomainEvent, IDomainEventInitProps } from '@ecoma-io/domain';

export type TenantCreatedEventPayload = {
  name: string;
  namespace: string;
};

export class TenantCreatedEvent extends DomainEvent<TenantCreatedEventPayload> {
  constructor(
    props: Omit<IDomainEventInitProps<TenantCreatedEventPayload>, 'type'>
  ) {
    super({
      ...props,
      type: 'TenantCreated',
    });
  }
}
