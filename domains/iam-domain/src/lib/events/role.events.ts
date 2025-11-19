import { DomainEvent, IDomainEventInitProps } from '@ecoma-io/domain';

export type RoleCreatedEventPayload = {
  roleId: string;
  tenantId: string;
  name: string;
  permissionKeys: string[];
};

export class RoleCreatedEvent extends DomainEvent<RoleCreatedEventPayload> {
  constructor(
    props: Omit<IDomainEventInitProps<RoleCreatedEventPayload>, 'type'>
  ) {
    super({
      ...props,
      type: 'RoleCreated',
    });
  }
}
