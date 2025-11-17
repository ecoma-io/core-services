import { ICommand } from '@ecoma-io/interactor';

export interface UpdateUserProfileCommand extends ICommand {
  userId: string;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
}

export const makeUpdateUserProfileCommand = (
  payload: UpdateUserProfileCommand
): UpdateUserProfileCommand => payload;
