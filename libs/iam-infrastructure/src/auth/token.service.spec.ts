import { TokenService, JwtPayload } from './token.service';
describe('TokenService', () => {
  let service: TokenService;
  beforeEach(() => {
    process.env.JWT_ACCESS_SECRET = 'test-access';
    process.env.JWT_REFRESH_SECRET = 'test-refresh';
    service = new TokenService();
  });
  it('should generate and validate access token', () => {
    const payload: JwtPayload = {
      userId: 'u1',
      tenantId: 't1',
      email: 'a@b.com',
      sub: 'u1',
    };
    const { accessToken } = service.generateTokenPair(payload);
    const decoded = service.validateAccessToken(accessToken);
    expect(decoded?.userId).toBe('u1');
    expect(decoded?.tenantId).toBe('t1');
  });
  it('should generate and validate refresh token', () => {
    const payload: JwtPayload = {
      userId: 'u2',
      tenantId: 't2',
      email: 'b@b.com',
      sub: 'u2',
    };
    const { refreshToken } = service.generateTokenPair(payload);
    const sub = service.validateRefreshToken(refreshToken);
    expect(sub).toBe('u2');
  });
  it('should return null for invalid access token', () => {
    expect(service.validateAccessToken('bad.token')).toBeNull();
  });
  it('should return null for invalid refresh token', () => {
    expect(service.validateRefreshToken('bad.token')).toBeNull();
  });
});
