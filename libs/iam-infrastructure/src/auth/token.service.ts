import { Injectable, Logger } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';

export interface JwtPayload {
  userId: string;
  tenantId: string;
  email: string;
  sub: string;
  iat?: number;
  exp?: number;
  [key: string]: unknown;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);
  private readonly accessSecret =
    process.env.JWT_ACCESS_SECRET || 'dev-access-secret';
  private readonly refreshSecret =
    process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret';
  private readonly accessTokenTtl = 3600; // 1h
  private readonly refreshTokenTtl = 30 * 24 * 3600; // 30d

  /**
   * Generate access & refresh token pair
   */
  generateTokenPair(payload: JwtPayload): TokenPair {
    const accessToken = jwt.sign(payload, this.accessSecret, {
      expiresIn: this.accessTokenTtl,
      // subject: payload.userId, // Không cần, đã có sub trong payload
    });
    const refreshToken = jwt.sign({ sub: payload.userId }, this.refreshSecret, {
      expiresIn: this.refreshTokenTtl,
      // subject: payload.userId,
    });
    return {
      accessToken,
      refreshToken,
      expiresIn: this.accessTokenTtl,
    };
  }

  /**
   * Validate access token
   */
  validateAccessToken(token: string): JwtPayload | null {
    try {
      return jwt.verify(token, this.accessSecret) as JwtPayload;
    } catch {
      this.logger.warn('Invalid access token');
      return null;
    }
  }

  /**
   * Validate refresh token
   */
  validateRefreshToken(token: string): string | null {
    try {
      const decoded = jwt.verify(token, this.refreshSecret) as JwtPayload;
      return decoded.sub;
    } catch {
      this.logger.warn('Invalid refresh token');
      return null;
    }
  }
}
