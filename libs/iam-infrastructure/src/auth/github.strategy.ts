import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-github2';

@Injectable()
export class GithubStrategy extends PassportStrategy(Strategy, 'github') {
  constructor() {
    super({
      clientID: process.env.GITHUB_CLIENT_ID || 'demo',
      clientSecret: process.env.GITHUB_CLIENT_SECRET || 'demo',
      callbackURL:
        process.env.GITHUB_CALLBACK_URL ||
        'http://localhost:4000/auth/github/callback',
      scope: ['user:email'],
    });
  }

  async validate(accessToken: string, refreshToken: string, profile: any) {
    // Map GitHub profile to app user object
    return {
      provider: 'github',
      githubId: profile.id,
      email: profile.emails?.[0]?.value,
      displayName: profile.displayName,
      avatar: profile.photos?.[0]?.value,
    };
  }
}
