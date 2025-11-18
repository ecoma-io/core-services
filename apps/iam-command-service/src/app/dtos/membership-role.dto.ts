import { IsString, IsArray } from 'class-validator';

/**
 * AssignRoleToMembershipDto - DTO for assigning role to membership
 */
export class AssignRoleToMembershipDto {
  @IsString()
  membershipId!: string;

  @IsString()
  roleId!: string;
}

/**
 * RemoveRoleFromMembershipDto - DTO for removing role from membership
 */
export class RemoveRoleFromMembershipDto {
  @IsString()
  membershipId!: string;

  @IsString()
  roleId!: string;
}
