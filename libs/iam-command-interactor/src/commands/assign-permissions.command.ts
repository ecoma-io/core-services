import { ICommand } from '@ecoma-io/interactor';

export interface AssignPermissionsCommand extends ICommand {
  roleId: string;
  permissionKeys: string[];
}

export const makeAssignPermissionsCommand = (
  payload: AssignPermissionsCommand
): AssignPermissionsCommand => payload;
