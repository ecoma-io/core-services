import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
// @ts-expect-error: no types for oidc-provider
import Provider from 'oidc-provider';

@Injectable()
export class OidcProviderService implements OnModuleInit {
  private readonly logger = new Logger(OidcProviderService.name);
  public provider!: InstanceType<typeof Provider>;

  async onModuleInit() {
    // Minimal OIDC config for MVP (development only)
    const config = {
      clients: [
        {
          client_id: 'demo-client',
          client_secret: 'demo-secret',
          grant_types: [
            'authorization_code',
            'refresh_token',
            'client_credentials',
          ],
          redirect_uris: ['http://localhost:3000/cb'],
          response_types: ['code'],
        },
      ],
      features: {
        devInteractions: { enabled: false },
        introspection: { enabled: true },
        revocation: { enabled: true },
        pkce: { required: () => false },
      },
      formats: { AccessToken: 'jwt' },
      // Minimal placeholder JWKS for development; replace with real keys in production
      jwks: {
        keys: [],
      },
      // TODO: Adapter for persistent storage
      // TODO: FindByUser, FindByClient, etc.
      // TODO: Customize interactions
    } as any;

    this.provider = new Provider('http://localhost:4000', config);
    this.logger.log('OIDC Provider initialized');
  }
}
