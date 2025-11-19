import { DomainEvent, IDomainEventInitProps } from '@ecoma-io/domain';

export type ServiceVersionRegisteredEventPayload = {
  serviceId: string;
  version: string;
  permissionsTree: unknown;
};

export class ServiceVersionRegisteredEvent extends DomainEvent<ServiceVersionRegisteredEventPayload> {
  constructor(
    props: Omit<
      IDomainEventInitProps<ServiceVersionRegisteredEventPayload>,
      'type'
    >
  ) {
    super({
      ...props,
      type: 'ServiceVersionRegistered',
    });
  }
}
