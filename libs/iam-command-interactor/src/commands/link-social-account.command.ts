import { ICommand } from '@ecoma-io/interactor';

export interface LinkSocialAccountCommand extends ICommand {
  userId: string;
  provider: string;
  providerId: string;
  providerEmail?: string;
}

export const makeLinkSocialAccountCommand = (
  payload: LinkSocialAccountCommand
): LinkSocialAccountCommand => payload;
