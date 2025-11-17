import { ICommand } from '@ecoma-io/interactor';

export interface PublishServiceVersionCommand extends ICommand {
  serviceId: string;
  version: string;
  permissionsTree: Record<string, unknown>;
}

export const makePublishServiceVersionCommand = (
  payload: PublishServiceVersionCommand
): PublishServiceVersionCommand => payload;
