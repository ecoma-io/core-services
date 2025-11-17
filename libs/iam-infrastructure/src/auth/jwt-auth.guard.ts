import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { TokenService } from './token.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly tokenService: TokenService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const auth = req.headers['authorization'] || req.headers['Authorization'];
    if (!auth || typeof auth !== 'string' || !auth.startsWith('Bearer ')) {
      return false;
    }
    const token = auth.slice(7);
    const payload = this.tokenService.validateAccessToken(token);
    if (!payload) return false;
    req.user = payload;
    return true;
  }
}
