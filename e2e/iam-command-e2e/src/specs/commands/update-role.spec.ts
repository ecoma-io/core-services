/**
 * E2E Tests for UpdateRole and AssignPermissions Commands
 *
 * Tests role update and permission assignment operations.
 */

import { v7 as uuidv7 } from 'uuid';
import { TestEnvironment } from '../../support/test.environment';

/**
 * Local test environment instance.
 * Started once for this suite and torn down after all tests.
 */
const environment = new TestEnvironment();

describe.skip('Role Update Commands E2E', () => {
  let tenantId: string;
  let roleId: string;

  beforeAll(async () => {
    await environment.start();
  }, 60000);

  afterAll(async () => {
    await environment.stop();
  }, 30000);

  describe('UpdateRole Command', () => {
    it('should update role name and description', async () => {
      // 1. Create tenant
      tenantId = uuidv7();
      await environment.commandService.post('/commands/create-tenant', {
        tenantId,
        name: 'Test Tenant',
        namespace: `ns-${tenantId.slice(0, 8)}`,
      });

      // 2. Create role
      roleId = uuidv7();
      const createRoleRes = await environment.commandService.post(
        '/commands/create-role',
        {
          roleId,
          tenantId,
          name: 'Admin',
          permissionKeys: ['users.read'],
        }
      );
      expect(createRoleRes.status).toBe(202);

      // Wait for projection
      await environment.waitForCheckpoint(
        'RoleProjector',
        createRoleRes.data.streamVersion
      );

      // 3. Update role
      const updateRoleRes = await environment.commandService.post(
        '/commands/update-role',
        {
          roleId,
          name: 'Super Admin',
          description: 'Full system access',
        }
      );
      expect(updateRoleRes.status).toBe(202);

      // Wait for projection
      await environment.waitForCheckpoint(
        'RoleProjector',
        updateRoleRes.data.streamVersion
      );

      // 4. Verify via query service
      const queryRes = await environment.queryService.get(`/roles/${roleId}`);
      expect(queryRes.status).toBe(200);
      expect(queryRes.data.name).toBe('Super Admin');
      expect(queryRes.data.description).toBe('Full system access');
    });

    it('should reject update for non-existent role', async () => {
      const nonExistentId = uuidv7();
      const updateRes = await environment.commandService.post(
        '/commands/update-role',
        {
          roleId: nonExistentId,
          name: 'Should Fail',
        }
      );
      expect(updateRes.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe('AssignPermissions Command', () => {
    it('should assign additional permissions to role', async () => {
      // 1. Create tenant
      tenantId = uuidv7();
      await environment.commandService.post('/commands/create-tenant', {
        tenantId,
        name: 'Test Tenant',
        namespace: `ns-${tenantId.slice(0, 8)}`,
      });

      // 2. Create role with initial permissions
      roleId = uuidv7();
      const createRoleRes = await environment.commandService.post(
        '/commands/create-role',
        {
          roleId,
          tenantId,
          name: 'Editor',
          permissionKeys: ['content.read'],
        }
      );
      expect(createRoleRes.status).toBe(202);

      // Wait for projection
      await environment.waitForCheckpoint(
        'RoleProjector',
        createRoleRes.data.streamVersion
      );

      // 3. Assign additional permissions
      const assignPermsRes = await environment.commandService.post(
        '/commands/assign-permissions',
        {
          roleId,
          permissions: ['content.write', 'content.delete'],
        }
      );
      expect(assignPermsRes.status).toBe(202);

      // Wait for projection
      await environment.waitForCheckpoint(
        'RoleProjector',
        assignPermsRes.data.streamVersion
      );

      // 4. Verify via query service
      const queryRes = await environment.queryService.get(`/roles/${roleId}`);
      expect(queryRes.status).toBe(200);
      expect(queryRes.data.permissionKeys).toContain('content.read');
      expect(queryRes.data.permissionKeys).toContain('content.write');
      expect(queryRes.data.permissionKeys).toContain('content.delete');
    });

    it('should handle duplicate permissions gracefully', async () => {
      // 1. Create tenant
      tenantId = uuidv7();
      await environment.commandService.post('/commands/create-tenant', {
        tenantId,
        name: 'Test Tenant',
        namespace: `ns-${tenantId.slice(0, 8)}`,
      });

      // 2. Create role
      roleId = uuidv7();
      const createRoleRes = await environment.commandService.post(
        '/commands/create-role',
        {
          roleId,
          tenantId,
          name: 'Viewer',
          permissionKeys: ['data.read'],
        }
      );
      await environment.waitForCheckpoint(
        'RoleProjector',
        createRoleRes.data.streamVersion
      );

      // 3. Assign same permission again
      const assignPermsRes = await environment.commandService.post(
        '/commands/assign-permissions',
        {
          roleId,
          permissions: ['data.read', 'data.write'],
        }
      );
      expect(assignPermsRes.status).toBe(202);
      await environment.waitForCheckpoint(
        'RoleProjector',
        assignPermsRes.data.streamVersion
      );

      // 4. Verify no duplicates
      const queryRes = await environment.queryService.get(`/roles/${roleId}`);
      expect(queryRes.status).toBe(200);
      const permissions = queryRes.data.permissionKeys;
      const uniquePerms = [...new Set(permissions)];
      expect(permissions.length).toBe(uniquePerms.length);
    });
  });

  describe('Combined UpdateRole and AssignPermissions', () => {
    it('should update role then assign permissions', async () => {
      // 1. Create tenant
      tenantId = uuidv7();
      await environment.commandService.post('/commands/create-tenant', {
        tenantId,
        name: 'Test Tenant',
        namespace: `ns-${tenantId.slice(0, 8)}`,
      });

      // 2. Create role
      roleId = uuidv7();
      const createRoleRes = await environment.commandService.post(
        '/commands/create-role',
        {
          roleId,
          tenantId,
          name: 'Basic User',
          permissionKeys: ['profile.read'],
        }
      );
      await environment.waitForCheckpoint(
        'RoleProjector',
        createRoleRes.data.streamVersion
      );

      // 3. Update role name
      const updateRoleRes = await environment.commandService.post(
        '/commands/update-role',
        {
          roleId,
          name: 'Power User',
          description: 'Enhanced access',
        }
      );
      await environment.waitForCheckpoint(
        'RoleProjector',
        updateRoleRes.data.streamVersion
      );

      // 4. Assign more permissions
      const assignPermsRes = await environment.commandService.post(
        '/commands/assign-permissions',
        {
          roleId,
          permissions: ['profile.write', 'settings.manage'],
        }
      );
      await environment.waitForCheckpoint(
        'RoleProjector',
        assignPermsRes.data.streamVersion
      );

      // 5. Verify all changes
      const queryRes = await environment.queryService.get(`/roles/${roleId}`);
      expect(queryRes.status).toBe(200);
      expect(queryRes.data.name).toBe('Power User');
      expect(queryRes.data.description).toBe('Enhanced access');
      expect(queryRes.data.permissionKeys).toContain('profile.read');
      expect(queryRes.data.permissionKeys).toContain('profile.write');
      expect(queryRes.data.permissionKeys).toContain('settings.manage');
    });
  });
});
