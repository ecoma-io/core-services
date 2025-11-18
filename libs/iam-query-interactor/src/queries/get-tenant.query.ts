import { IQuery } from '@ecoma-io/interactor';

/**
 * Query to retrieve a tenant by ID.
 *
 * @see GetTenantHandler
 */
export interface GetTenantQuery extends IQuery {
  tenantId: string;
}

/**
 * Factory function to create GetTenantQuery.
 *
 * @param tenantId - UUID of the tenant
 * @returns GetTenantQuery instance
 */
export const makeGetTenantQuery = (tenantId: string): GetTenantQuery => ({
  tenantId,
});
