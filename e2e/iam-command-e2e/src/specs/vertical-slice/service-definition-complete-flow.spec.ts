import axios from 'axios';
import { TestEnvironment } from '../../support/test.environment';
import { v4 as uuidv4 } from 'uuid';

interface Context {
  commandUrl: string;
  queryUrl: string;
}

describe('Vertical Slice - ServiceDefinition Complete Flow', () => {
  const environment = new TestEnvironment();
  let context: Context;

  beforeAll(async () => {
    await environment.start();
    context = {
      commandUrl: `http://localhost:${environment.commandServicePort}`,
      queryUrl: `http://localhost:${environment.queryServicePort}`,
    };
  }, 60000);

  afterAll(async () => {
    await environment?.stop();
  });

  /**
   * Complete vertical slice test: RegisterServiceVersion → ServiceDefinitionProjector → GetServiceDefinition
   *
   * Flow:
   * 1. Register first version via command (v1.0.0)
   * 2. Wait for projection (RYOW pattern)
   * 3. Verify via query
   * 4. Register multiple versions (v1.1.0, v2.0.0, v2.1.0, v3.0.0) to test pruning
   * 5. Verify top 3 major versions kept (latest of each: v3.0.0, v2.1.0, v1.1.0)
   */
  it('should register service versions via command and read them back via query with pruning', async () => {
    const serviceId = uuidv4();
    const serviceName = 'test-service';

    // 1. Register first version (v1.0.0)
    const v1Response = await axios.post(
      `${context.commandUrl}/commands/register-service-version`,
      {
        serviceId,
        version: '1.0.0',
        name: serviceName,
        permissionsTree: { resources: { list: {} } },
      }
    );

    expect(v1Response.status).toBe(202);
    expect(v1Response.data).toMatchObject({
      serviceId,
      version: '1.0.0',
      streamVersion: 0,
    });

    // 2. Poll for projection (RYOW - Read Your Own Writes)
    let serviceFound = false;
    const timeout = Date.now() + 5000;
    let service: any;

    while (Date.now() < timeout && !serviceFound) {
      try {
        const getResponse = await axios.get(
          `${context.queryUrl}/service-definitions/${serviceId}`
        );
        service = getResponse.data;
        serviceFound = !!service;
        break;
      } catch (err: any) {
        if (err.response?.status !== 404) throw err;
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
    }

    expect(serviceFound).toBe(true);
    expect(service).toMatchObject({
      serviceId,
      name: serviceName,
      versions: [
        {
          version: '1.0.0',
          permissionsTree: { resources: { list: {} } },
        },
      ],
    });

    // 3. Register v1.1.0 (newer patch in same major)
    await axios.post(
      `${context.commandUrl}/commands/register-service-version`,
      {
        serviceId,
        version: '1.1.0',
        name: serviceName,
        permissionsTree: { resources: { list: {}, read: {} } },
      }
    );

    // 4. Register v2.0.0 (new major version)
    await axios.post(
      `${context.commandUrl}/commands/register-service-version`,
      {
        serviceId,
        version: '2.0.0',
        name: serviceName,
        permissionsTree: { resources: { list: {}, read: {}, write: {} } },
      }
    );

    // 5. Register v2.1.0 (newer minor in major 2)
    await axios.post(
      `${context.commandUrl}/commands/register-service-version`,
      {
        serviceId,
        version: '2.1.0',
        name: serviceName,
        permissionsTree: {
          resources: { list: {}, read: {}, write: {}, delete: {} },
        },
      }
    );

    // 6. Register v3.0.0 (new major version)
    await axios.post(
      `${context.commandUrl}/commands/register-service-version`,
      {
        serviceId,
        version: '3.0.0',
        name: serviceName,
        permissionsTree: {
          resources: { list: {}, read: {}, write: {}, delete: {} },
          admin: { all: {} },
        },
      }
    );

    // 7. Register v4.0.0 (4th major - should trigger pruning, removing v1.x)
    await axios.post(
      `${context.commandUrl}/commands/register-service-version`,
      {
        serviceId,
        version: '4.0.0',
        name: serviceName,
        permissionsTree: {
          resources: { list: {}, read: {}, write: {}, delete: {} },
          admin: { all: {} },
          superadmin: { all: {} },
        },
      }
    );

    // 8. Wait for all projections to complete
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // 9. Verify final state: should have top 3 majors (4.0.0, 3.0.0, 2.1.0)
    const finalResponse = await axios.get(
      `${context.queryUrl}/service-definitions/${serviceId}`
    );
    const finalService = finalResponse.data;

    expect(finalService.versions).toHaveLength(3);

    // Verify versions are sorted descending (newest first)
    const versions = finalService.versions.map((v: any) => v.version);
    expect(versions).toEqual(['4.0.0', '3.0.0', '2.1.0']);

    // Verify v1.x was pruned (not in top 3 majors)
    expect(versions).not.toContain('1.0.0');
    expect(versions).not.toContain('1.1.0');

    // Verify v2.0.0 was pruned (v2.1.0 kept as latest of major 2)
    expect(versions).not.toContain('2.0.0');

    // Verify permission trees are correct
    expect(finalService.versions[0]).toMatchObject({
      version: '4.0.0',
      permissionsTree: {
        resources: { list: {}, read: {}, write: {}, delete: {} },
        admin: { all: {} },
        superadmin: { all: {} },
      },
    });

    expect(finalService.versions[1]).toMatchObject({
      version: '3.0.0',
      permissionsTree: {
        resources: { list: {}, read: {}, write: {}, delete: {} },
        admin: { all: {} },
      },
    });

    expect(finalService.versions[2]).toMatchObject({
      version: '2.1.0',
      permissionsTree: {
        resources: { list: {}, read: {}, write: {}, delete: {} },
      },
    });
  }, 15000);

  /**
   * Negative test: Query for non-existent service definition
   */
  it('should return 404 for non-existent service definition', async () => {
    const nonExistentId = '00000000-0000-0000-0000-000000000000';

    try {
      await axios.get(
        `${context.queryUrl}/service-definitions/${nonExistentId}`
      );
      fail('Should have thrown 404');
    } catch (err: any) {
      expect(err.response.status).toBe(404);
      expect(err.response.data.message).toContain('not found');
    }
  });

  /**
   * Health check test: Verify query service is healthy
   */
  it('GET /health/liveness -> 200 on query service', async () => {
    const res = await axios.get(`${context.queryUrl}/health/liveness`);
    expect(res.status).toBe(200);
    expect(res.data.message).toContain('alive');
  });
});
