import { IsString, IsArray, IsOptional } from 'class-validator';

/**
 * UpdateRoleDto - DTO for updating role information
 */
export class UpdateRoleDto {
  @IsString()
  roleId!: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissions?: string[];
}
