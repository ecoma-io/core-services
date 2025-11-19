import { DomainEvent, IDomainEventInitProps } from '@ecoma-io/domain';

export type AddedUserToTenantEventPayload = {
  membershipId: string;
  userId: string;
  tenantId: string;
};

export class AddedUserToTenantEvent extends DomainEvent<AddedUserToTenantEventPayload> {
  constructor(
    payload: Omit<IDomainEventInitProps<AddedUserToTenantEventPayload>, 'type'>
  ) {
    super({
      ...payload,
      type: 'UserAddedToTenant',
    });
  }
}
