import { IQuery } from '@ecoma-io/interactor';

export interface GetUserQuery extends IQuery {
  userId: string;
}

export const makeGetUserQuery = (userId: string): GetUserQuery => ({ userId });
