import { IQuery } from '@ecoma-io/interactor';

export interface GetRoleQuery extends IQuery {
  roleId: string;
}

export const makeGetRoleQuery = (roleId: string): GetRoleQuery => ({ roleId });
