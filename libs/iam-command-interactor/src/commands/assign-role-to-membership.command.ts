import { ICommand } from '@ecoma-io/interactor';

export interface AssignRoleToMembershipCommand extends ICommand {
  membershipId: string;
  roleId: string;
}

export const makeAssignRoleToMembershipCommand = (
  payload: AssignRoleToMembershipCommand
): AssignRoleToMembershipCommand => payload;
