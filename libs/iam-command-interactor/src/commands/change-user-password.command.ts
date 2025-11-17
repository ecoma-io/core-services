import { ICommand } from '@ecoma-io/interactor';

export interface ChangeUserPasswordCommand extends ICommand {
  userId: string;
  newPassword: string;
}

export const makeChangeUserPasswordCommand = (
  payload: ChangeUserPasswordCommand
): ChangeUserPasswordCommand => payload;
