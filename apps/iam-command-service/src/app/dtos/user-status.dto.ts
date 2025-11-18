import { IsString } from 'class-validator';

/**
 * ActivateUserDto - DTO for activating user
 */
export class ActivateUserDto {
  @IsString()
  userId!: string;
}

/**
 * SuspendUserDto - DTO for suspending user
 */
export class SuspendUserDto {
  @IsString()
  userId!: string;

  @IsString()
  reason!: string;
}
