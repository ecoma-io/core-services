import axios from 'axios';
import { ProjectorTestEnvironment } from '../support/test.environment';

interface Context {
  commandBaseUrl: string;
}

describe('Projection - TenantProjector', () => {
  const environment = new ProjectorTestEnvironment();
  let context: Context;

  beforeAll(async () => {
    await environment.start();
    context = {
      commandBaseUrl: `http://localhost:${environment.commandServiceContainer.getMappedPort(3000)}`,
    };
  }, 120000);

  afterAll(async () => {
    await environment.stop();
  }, 60000);

  it('CreateTenant command should project into tenants_read_model', async () => {
    const payload = {
      name: 'Beta Corp',
      namespace: 'beta',
      metadata: { tier: 'gold' },
    };

    const res = await axios.post(
      `${context.commandBaseUrl}/commands/create-tenant`,
      payload
    );

    expect(res.status).toBe(202);
    const tenantId: string = res.data.tenantId;
    expect(typeof tenantId).toBe('string');

    // Poll read model for projected row (RYOW)
    const row = await environment.pollTenantRow(tenantId, 8000, 300);
    expect(row).not.toBeNull();
    expect(row!.tenant_id).toBe(tenantId);
    expect(row!.namespace).toBe('beta');
    expect(row!.metadata).toMatchObject({ tier: 'gold' });
  });
});
