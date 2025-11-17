import { ICommand } from '@ecoma-io/interactor';

export interface RegisterServiceCommand extends ICommand {
  serviceId: string;
  name: string;
  permissionsTree: Record<string, unknown>;
  version: string;
}

export const makeRegisterServiceCommand = (
  payload: RegisterServiceCommand
): RegisterServiceCommand => payload;
