import { Injectable } from '@nestjs/common';
import { MembershipReadRepository } from '@ecoma-io/iam-infrastructure';
import { MembershipEntity } from '@ecoma-io/iam-infrastructure';
import { GetMembershipQuery } from '../queries/get-membership.query';

/**
 * GetMembershipHandler
 *
 * Query handler for retrieving membership by ID.
 * Returns MembershipEntity from read model or null if not found.
 *
 * @see ADR-1: CQRS - Query side handler
 */
@Injectable()
export class GetMembershipHandler {
  constructor(
    private readonly membershipRepository: MembershipReadRepository
  ) {}

  async execute(query: GetMembershipQuery): Promise<MembershipEntity | null> {
    return this.membershipRepository.findById(query.membershipId);
  }
}
