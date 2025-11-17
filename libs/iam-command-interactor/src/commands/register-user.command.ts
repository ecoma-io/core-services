import { ICommand } from '@ecoma-io/interactor';

export interface RegisterUserCommand extends ICommand {
  userId: string;
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

export const makeRegisterUserCommand = (
  payload: RegisterUserCommand
): RegisterUserCommand => payload;
