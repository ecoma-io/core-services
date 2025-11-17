import { ICommand } from '@ecoma-io/interactor';

export interface RemoveRoleFromMembershipCommand extends ICommand {
  membershipId: string;
  roleId: string;
}

export const makeRemoveRoleFromMembershipCommand = (
  payload: RemoveRoleFromMembershipCommand
): RemoveRoleFromMembershipCommand => payload;
