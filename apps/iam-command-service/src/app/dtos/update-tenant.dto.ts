import { IsString, IsOptional, IsObject } from 'class-validator';

/**
 * UpdateTenantDto - DTO for updating tenant information
 */
export class UpdateTenantDto {
  @IsString()
  tenantId!: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
