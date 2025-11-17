import { ICommand } from '@ecoma-io/interactor';

export interface UpdateRoleCommand extends ICommand {
  roleId: string;
  name?: string;
  description?: string;
}

export const makeUpdateRoleCommand = (
  payload: UpdateRoleCommand
): UpdateRoleCommand => payload;
