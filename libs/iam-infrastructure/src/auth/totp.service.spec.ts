import { TOTPService } from './totp.service';
describe('TOTPService', () => {
  let service: TOTPService;
  beforeEach(() => {
    service = new TOTPService();
  });
  it('should generate and verify TOTP', () => {
    const { ascii } = service.generateSecret('test@ecoma.io');
    const token = require('speakeasy').totp({
      secret: ascii,
      encoding: 'ascii',
    });
    expect(service.verify(token, ascii)).toBe(true);
  });
  it('should fail for wrong token', () => {
    const { ascii } = service.generateSecret('test@ecoma.io');
    expect(service.verify('000000', ascii)).toBe(false);
  });
});
