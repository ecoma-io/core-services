import { Module } from '@nestjs/common';
import { TokenService } from './token.service';
import { AuthController } from './auth.controller';
import { JwtAuthGuard } from './jwt-auth.guard';
import { OidcModule } from './oidc.module';
import { OidcController } from './oidc.controller';
import { TOTPService } from './totp.service';
import { GithubStrategy } from './github.strategy';
import { SocialLoginService } from './social-login.service';

@Module({
  imports: [OidcModule],
  providers: [
    TokenService,
    JwtAuthGuard,
    TOTPService,
    GithubStrategy,
    SocialLoginService,
  ],
  controllers: [AuthController, OidcController],
  exports: [
    TokenService,
    JwtAuthGuard,
    OidcModule,
    TOTPService,
    GithubStrategy,
    SocialLoginService,
  ],
})
export class AuthModule {}
