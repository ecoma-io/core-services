import axios from 'axios';
import { TestEnvironment } from '../../support/test.environment';

interface Context {
  baseUrl: string;
}

describe('Commands - Create Tenant', () => {
  const environment = new TestEnvironment();
  let context: Context;

  beforeAll(async () => {
    await environment.start();
    context = {
      baseUrl: `http://localhost:${environment.resourceServiceContainer.getMappedPort(3000)}`,
    };
  }, 60000);

  afterAll(async () => {
    await environment.stop();
  }, 30000);

  it('POST /commands/create-tenant -> 202 with valid payload', async () => {
    const payload = {
      name: 'Acme Corp',
      namespace: 'acme',
      metadata: { tier: 'standard' },
    };

    try {
      const res = await axios.post(
        `${context.baseUrl}/commands/create-tenant`,
        payload
      );

      expect(res.status).toBe(202);
      expect(typeof res.data.tenantId).toBe('string');
      expect(typeof res.data.streamVersion).toBe('number');
    } catch (err: any) {
      // Debug output to help diagnose failures in CI
      // eslint-disable-next-line no-console
      console.error(
        'CreateTenant error:',
        err?.response?.status,
        err?.response?.data
      );
      throw err;
    }
  });

  it('POST /commands/create-tenant -> 422 with empty body', async () => {
    await expect(
      axios.post(`${context.baseUrl}/commands/create-tenant`, {})
    ).rejects.toMatchObject({ response: { status: 422 } });
  });
});
