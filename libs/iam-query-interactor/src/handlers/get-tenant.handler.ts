import { Injectable } from '@nestjs/common';
import { IQueryHandler } from '@ecoma-io/interactor';
import { GetTenantQuery } from '../queries/get-tenant.query';
import { TenantReadRepository } from '@ecoma-io/iam-infrastructure';
import { TenantEntity } from '@ecoma-io/iam-infrastructure';

/**
 * Handler for GetTenantQuery.
 *
 * Retrieves a tenant from the read model by ID.
 *
 * @see ADR-1: CQRS - Query Side
 * @see GetTenantQuery
 */
@Injectable()
export class GetTenantHandler
  implements IQueryHandler<GetTenantQuery, TenantEntity | null>
{
  constructor(private readonly tenantRepo: TenantReadRepository) {}

  /**
   * Execute the query to retrieve a tenant.
   *
   * @param query - GetTenantQuery containing tenantId
   * @returns TenantEntity if found, null otherwise
   */
  async execute(query: GetTenantQuery): Promise<TenantEntity | null> {
    return this.tenantRepo.findById(query.tenantId);
  }
}
