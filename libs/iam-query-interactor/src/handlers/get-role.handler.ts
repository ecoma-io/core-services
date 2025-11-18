import { Injectable } from '@nestjs/common';
import { IQueryHandler } from '@ecoma-io/interactor';
import { GetRoleQuery } from '../queries/get-role.query';
import { RoleReadRepository } from '@ecoma-io/iam-infrastructure';
import { RoleEntity } from '@ecoma-io/iam-infrastructure';

/**
 * Handler for GetRoleQuery.
 *
 * Retrieves a role from the read model by ID.
 *
 * @see ADR-1: CQRS - Query Side
 * @see GetRoleQuery
 */
@Injectable()
export class GetRoleHandler
  implements IQueryHandler<GetRoleQuery, RoleEntity | null>
{
  constructor(private readonly roleRepo: RoleReadRepository) {}

  /**
   * Execute the query to retrieve a role.
   *
   * @param query - GetRoleQuery containing roleId
   * @returns RoleEntity if found, null otherwise
   */
  async execute(query: GetRoleQuery): Promise<RoleEntity | null> {
    return this.roleRepo.findById(query.roleId);
  }
}
