import { ICommand } from '@ecoma-io/interactor';

export interface CreateMembershipCommand extends ICommand {
  membershipId: string;
  userId: string;
  tenantId: string;
}

export const makeCreateMembershipCommand = (
  payload: CreateMembershipCommand
): CreateMembershipCommand => payload;
