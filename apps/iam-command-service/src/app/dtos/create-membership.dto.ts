import { IsUUID, IsNotEmpty } from 'class-validator';

/**
 * CreateMembership Command DTO
 *
 * Represents the request to create a new user-tenant membership.
 * Links a user to a tenant (multi-tenancy support).
 */
export class CreateMembershipDto {
  @IsUUID('4')
  @IsNotEmpty()
  membershipId!: string;

  @IsUUID('4')
  @IsNotEmpty()
  userId!: string;

  @IsUUID('4')
  @IsNotEmpty()
  tenantId!: string;
}
