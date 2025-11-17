import {
  Body,
  Controller,
  Post,
  Req,
  UseGuards,
  Get,
  Res,
} from '@nestjs/common';
import { TokenService } from './token.service';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { TOTPService } from './totp.service';
import { SocialLoginService } from './social-login.service';
import { AuthGuard } from '@nestjs/passport';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly tokenService: TokenService,
    private readonly totpService: TOTPService,
    private readonly socialLogin: SocialLoginService
  ) {}

  // TODO: Replace with real user lookup
  private async validateUser(email: string, password: string) {
    // Fake user for demo
    if (email === 'admin@ecoma.io' && password === 'password123') {
      return { userId: 'u1', tenantId: 't1', email };
    }
    return null;
  }

  @Post('login')
  async login(@Body() dto: LoginDto) {
    const user = await this.validateUser(dto.email, dto.password);
    if (!user) {
      return { error: 'Invalid credentials' };
    }
    const tokens = this.tokenService.generateTokenPair({
      userId: user.userId,
      tenantId: user.tenantId,
      email: user.email,
      sub: user.userId,
    });
    return {
      ...tokens,
      user: { userId: user.userId, tenantId: user.tenantId, email: user.email },
    };
  }

  @Post('refresh')
  async refresh(@Body('refreshToken') refreshToken: string) {
    const userId = this.tokenService.validateRefreshToken(refreshToken);
    if (!userId) {
      return { error: 'Invalid refresh token' };
    }
    // TODO: Lookup user by userId
    const tokens = this.tokenService.generateTokenPair({
      userId,
      tenantId: 't1', // TODO: get real tenantId
      email: 'admin@ecoma.io', // TODO: get real email
      sub: userId,
    });
    return tokens;
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@Req() req) {
    return req.user;
  }

  @Post('mfa/setup')
  async mfaSetup(@Body('email') email: string) {
    const secret = this.totpService.generateSecret(email);
    return {
      ascii: secret.ascii,
      base32: secret.base32,
      otpauth_url: secret.otpauth_url,
      qr: this.totpService.getQRCodeUrl(secret.base32),
    };
  }

  @Post('mfa/verify')
  async mfaVerify(@Body() body: { token: string; secret: string }) {
    const valid = this.totpService.verify(body.token, body.secret);
    return { valid };
  }

  @Get('github')
  @UseGuards(AuthGuard('github'))
  async githubLogin() {
    // Passport will redirect
  }

  @Get('github/callback')
  @UseGuards(AuthGuard('github'))
  async githubCallback(@Req() req, @Res() res) {
    // req.user is set by GithubStrategy
    const user = await this.socialLogin.handleGithubLogin(req.user);
    // Issue JWT for user
    const tokens = this.tokenService.generateTokenPair({
      userId: user.userId,
      email: user.email,
      tenantId: 't1', // TODO: real tenant
      sub: user.userId,
    });
    // For demo: return tokens as JSON
    return res.json({ ...tokens, user });
  }
}
