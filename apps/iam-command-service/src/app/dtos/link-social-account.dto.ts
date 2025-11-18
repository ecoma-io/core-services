import { IsString, IsEnum } from 'class-validator';

/**
 * LinkSocialAccountDto - DTO for linking social account
 */
export class LinkSocialAccountDto {
  @IsString()
  userId!: string;

  @IsEnum(['github', 'google', 'facebook'])
  provider!: 'github' | 'google' | 'facebook';

  @IsString()
  providerId!: string;

  @IsString()
  providerEmail!: string;
}
