/**
 * GetMembership Query
 *
 * Query to retrieve a membership by ID.
 * Returns membership with user-tenant linkage and assigned roles.
 */
export class GetMembershipQuery {
  constructor(public readonly membershipId: string) {}
}

/**
 * Factory function for creating GetMembershipQuery instances.
 */
export function makeGetMembershipQuery(
  membershipId: string
): GetMembershipQuery {
  return new GetMembershipQuery(membershipId);
}
