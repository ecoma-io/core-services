import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { TokenService } from './token.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { ExecutionContext } from '@nestjs/common';

describe('AuthController', () => {
  let controller: AuthController;
  let tokenService: TokenService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [TokenService, JwtAuthGuard],
    }).compile();
    controller = module.get<AuthController>(AuthController);
    tokenService = module.get<TokenService>(TokenService);
  });

  it('should return tokens for valid login', async () => {
    const res = await controller.login({
      email: 'admin@ecoma.io',
      password: 'password123',
    });
    if ('error' in res) throw new Error('Expected success');
    expect(res.accessToken).toBeDefined();
    expect(res.refreshToken).toBeDefined();
    expect(res.user.email).toBe('admin@ecoma.io');
  });

  it('should return error for invalid login', async () => {
    const res = await controller.login({
      email: 'wrong@ecoma.io',
      password: 'bad',
    });
    expect('error' in res && res.error).toBe('Invalid credentials');
  });

  it('should return tokens for valid refresh', async () => {
    const login = await controller.login({
      email: 'admin@ecoma.io',
      password: 'password123',
    });
    if ('error' in login) throw new Error('Expected success');
    const res = await controller.refresh(login.refreshToken);
    if ('error' in res) throw new Error('Expected success');
    expect(res.accessToken).toBeDefined();
    expect(res.refreshToken).toBeDefined();
  });

  it('should return error for invalid refresh', async () => {
    const res = await controller.refresh('bad.token');
    expect('error' in res && res.error).toBe('Invalid refresh token');
  });

  it('should return user for /me with JwtAuthGuard', async () => {
    // Simulate request with user and headers
    const token = tokenService.generateTokenPair({
      userId: 'u1',
      tenantId: 't1',
      email: 'admin@ecoma.io',
      sub: 'u1',
    }).accessToken;
    const req = {
      headers: { authorization: `Bearer ${token}` },
      user: { userId: 'u1', email: 'admin@ecoma.io' },
    };
    const guard = new JwtAuthGuard(tokenService);
    const context = {
      switchToHttp: () => ({ getRequest: () => req }),
    } as unknown as ExecutionContext;
    expect(guard.canActivate(context)).toBe(true);
    const me = await controller.me(req as any);
    expect(me).toMatchObject({
      userId: 'u1',
      email: 'admin@ecoma.io',
      tenantId: 't1',
    });
  });
});
