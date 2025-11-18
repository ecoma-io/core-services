import { IsString, IsNotEmpty, IsUUID, IsObject } from 'class-validator';

/**
 * RegisterServiceVersionDto - DTO for registering a new service version.
 *
 * Validates:
 * - serviceId: UUID v4
 * - version: Semantic version string (e.g., "1.2.3")
 * - name: Service name
 * - permissionsTree: Permissions hierarchy object
 */
export class RegisterServiceVersionDto {
  @IsUUID('4')
  @IsNotEmpty()
  serviceId!: string;

  @IsString()
  @IsNotEmpty()
  version!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsObject()
  @IsNotEmpty()
  permissionsTree!: Record<string, unknown>;
}
