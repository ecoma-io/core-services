import { ICommand } from '@ecoma-io/interactor';

export interface CreateTenantCommand extends ICommand {
  tenantId: string;
  name: string;
  namespace: string;
  metadata?: Record<string, unknown>;
}

export const makeCreateTenantCommand = (
  payload: CreateTenantCommand
): CreateTenantCommand => payload;
