/**
 * E2E Tests for UpdateTenant Command
 *
 * Tests tenant update operations including name and metadata changes.
 */

import { v7 as uuidv7 } from 'uuid';
import { TestEnvironment } from '../../support/test.environment';

/**
 * Local test environment instance for tenant update tests.
 * Mirrors lifecycle pattern used in other command specs.
 */
const environment = new TestEnvironment();

describe.skip('UpdateTenant Command E2E', () => {
  let tenantId: string;

  beforeAll(async () => {
    await environment.start();
  }, 60000);

  afterAll(async () => {
    await environment.stop();
  }, 30000);

  it('should update tenant name and metadata', async () => {
    // 1. Create tenant
    tenantId = uuidv7();
    const createRes = await environment.commandService.post(
      '/commands/create-tenant',
      {
        tenantId,
        name: 'Original Name',
        namespace: `ns-${tenantId.slice(0, 8)}`,
        metadata: { version: 1 },
      }
    );
    expect(createRes.status).toBe(202);

    // Wait for projection
    await environment.waitForCheckpoint(
      'TenantProjector',
      createRes.data.streamVersion
    );

    // 2. Update tenant
    const updateRes = await environment.commandService.post(
      '/commands/update-tenant',
      {
        tenantId,
        name: 'Updated Name',
        metadata: { version: 2, updated: true },
      }
    );
    expect(updateRes.status).toBe(202);

    // Wait for projection
    await environment.waitForCheckpoint(
      'TenantProjector',
      updateRes.data.streamVersion
    );

    // 3. Verify via query service
    const queryRes = await environment.queryService.get(`/tenants/${tenantId}`);
    expect(queryRes.status).toBe(200);
    expect(queryRes.data.name).toBe('Updated Name');
    expect(queryRes.data.metadata).toEqual({ version: 2, updated: true });
  });

  it('should update only name without metadata', async () => {
    // 1. Create tenant
    tenantId = uuidv7();
    const createRes = await environment.commandService.post(
      '/commands/create-tenant',
      {
        tenantId,
        name: 'Original',
        namespace: `ns-${tenantId.slice(0, 8)}`,
      }
    );
    expect(createRes.status).toBe(202);
    await environment.waitForCheckpoint(
      'TenantProjector',
      createRes.data.streamVersion
    );

    // 2. Update only name
    const updateRes = await environment.commandService.post(
      '/commands/update-tenant',
      {
        tenantId,
        name: 'New Name Only',
      }
    );
    expect(updateRes.status).toBe(202);
    await environment.waitForCheckpoint(
      'TenantProjector',
      updateRes.data.streamVersion
    );

    // 3. Verify
    const queryRes = await environment.queryService.get(`/tenants/${tenantId}`);
    expect(queryRes.status).toBe(200);
    expect(queryRes.data.name).toBe('New Name Only');
  });

  it('should reject update for non-existent tenant', async () => {
    const nonExistentId = uuidv7();
    const updateRes = await environment.commandService.post(
      '/commands/update-tenant',
      {
        tenantId: nonExistentId,
        name: 'Should Fail',
      }
    );
    expect(updateRes.status).toBeGreaterThanOrEqual(400);
  });
});
