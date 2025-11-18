import { Controller, Req, Res, All } from '@nestjs/common';
import { OidcProviderService } from './oidc-provider.service';

@Controller()
export class OidcController {
  constructor(private readonly oidc: OidcProviderService) {}

  @All(['/oidc/*', '/.well-known/*', '/oauth/*'])
  async proxy(@Req() req, @Res() res) {
    // Proxy all OIDC/OAuth endpoints to oidc-provider
    return this.oidc.provider.callback(req, res);
  }
}
