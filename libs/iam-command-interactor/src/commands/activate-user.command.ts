import { ICommand } from '@ecoma-io/interactor';

export interface ActivateUserCommand extends ICommand {
  userId: string;
}

export const makeActivateUserCommand = (
  payload: ActivateUserCommand
): ActivateUserCommand => payload;
