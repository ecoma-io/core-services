import { ICommand } from '@ecoma-io/interactor';

export interface SuspendUserCommand extends ICommand {
  userId: string;
}

export const makeSuspendUserCommand = (
  payload: SuspendUserCommand
): SuspendUserCommand => payload;
