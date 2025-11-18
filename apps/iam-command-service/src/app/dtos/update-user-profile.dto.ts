import { IsString, IsOptional } from 'class-validator';

/**
 * UpdateUserProfileDto - DTO for updating user profile
 */
export class UpdateUserProfileDto {
  @IsString()
  userId!: string;

  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsString()
  avatarUrl?: string;
}
