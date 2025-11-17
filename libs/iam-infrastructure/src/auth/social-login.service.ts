import { Injectable } from '@nestjs/common';

@Injectable()
export class SocialLoginService {
  // In real app: lookup or create user by providerId/email
  async handleGithubLogin(profile: any) {
    // For demo: always return mapped user
    return {
      userId: profile.githubId,
      email: profile.email,
      displayName: profile.displayName,
      avatar: profile.avatar,
      provider: 'github',
    };
  }
}
