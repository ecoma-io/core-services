import { IsString, IsObject } from 'class-validator';

/**
 * RegisterServiceDto - DTO for registering a new service
 */
export class RegisterServiceDto {
  @IsString()
  serviceId!: string;

  @IsString()
  name!: string;

  @IsString()
  version!: string;

  @IsObject()
  permissionsTree!: Record<string, unknown>;
}

/**
 * PublishServiceVersionDto - DTO for publishing a new service version
 */
export class PublishServiceVersionDto {
  @IsString()
  serviceId!: string;

  @IsString()
  version!: string;

  @IsObject()
  permissionsTree!: Record<string, unknown>;
}
