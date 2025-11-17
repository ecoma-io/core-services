import { Injectable } from '@nestjs/common';
import * as speakeasy from 'speakeasy';

@Injectable()
export class TOTPService {
  generateSecret(email: string) {
    return speakeasy.generateSecret({
      name: `Ecoma IAM (${email})`,
      length: 20,
    });
  }

  getQRCodeUrl(secret: string) {
    return `otpauth://totp/EcomaIAM?secret=${secret}&issuer=Ecoma`;
  }

  verify(token: string, secret: string) {
    return speakeasy.totp.verify({
      secret,
      encoding: 'ascii',
      token,
      window: 1,
    });
  }
}
