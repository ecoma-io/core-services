import { Controller, Get, Param } from '@nestjs/common';
import { NotFoundException } from '@ecoma-io/nestjs-exceptions';
import { GetMembershipHandler } from '@ecoma-io/iam-query-interactor';
import { GetMembershipQuery } from '@ecoma-io/iam-query-interactor';

/**
 * MembershipsController
 *
 * REST controller for membership queries (read side).
 * Provides endpoints to retrieve user-tenant membership information.
 *
 * @see ADR-1: CQRS - Query side controller
 */
@Controller('memberships')
export class MembershipsController {
  constructor(private readonly getMembershipHandler: GetMembershipHandler) {}

  /**
   * Get membership by ID
   *
   * @param id - Membership UUID
   * @returns Membership entity with user-tenant linkage and role assignments
   * @throws NotFoundException if membership not found
   */
  @Get(':id')
  async getMembership(@Param('id') id: string) {
    const membership = await this.getMembershipHandler.execute(
      new GetMembershipQuery(id)
    );

    if (!membership) {
      throw new NotFoundException(`Membership ${id} not found`);
    }

    return membership;
  }
}
