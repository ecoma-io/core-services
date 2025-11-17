import { ICommand } from '@ecoma-io/interactor';

export interface CreateRoleCommand extends ICommand {
  roleId: string;
  tenantId: string;
  name: string;
  description?: string;
  permissionKeys: string[];
}

export const makeCreateRoleCommand = (
  payload: CreateRoleCommand
): CreateRoleCommand => payload;
