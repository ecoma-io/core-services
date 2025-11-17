import { ICommand } from '@ecoma-io/interactor';

export interface UpdateTenantCommand extends ICommand {
  tenantId: string;
  name?: string;
  metadata?: Record<string, unknown>;
}

export const makeUpdateTenantCommand = (
  payload: UpdateTenantCommand
): UpdateTenantCommand => payload;
