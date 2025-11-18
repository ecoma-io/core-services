import { IsString, IsArray } from 'class-validator';

/**
 * AssignPermissionsDto - DTO for assigning permissions to role
 */
export class AssignPermissionsDto {
  @IsString()
  roleId!: string;

  @IsString()
  tenantId!: string;

  @IsArray()
  @IsString({ each: true })
  permissions!: string[];
}
