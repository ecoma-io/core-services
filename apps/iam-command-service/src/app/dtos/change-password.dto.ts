import { IsString, MinLength } from 'class-validator';

/**
 * ChangePasswordDto - DTO for changing user password
 */
export class ChangePasswordDto {
  @IsString()
  userId!: string;

  @IsString()
  oldPassword!: string;

  @IsString()
  @MinLength(8)
  newPassword!: string;
}
