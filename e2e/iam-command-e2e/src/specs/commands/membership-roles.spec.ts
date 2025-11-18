/**
 * E2E Tests for Membership Role Management Commands
 *
 * Tests role assignment and removal from memberships.
 */

import { v7 as uuidv7 } from 'uuid';
import { TestEnvironment } from '../../support/test.environment';

/**
 * Local test environment instance for membership role command tests.
 */
const environment = new TestEnvironment();

describe.skip('Membership Role Commands E2E', () => {
  let tenantId: string;
  let roleId: string;
  let userId: string;
  let membershipId: string;

  beforeAll(async () => {
    await environment.start();
  }, 60000);

  afterAll(async () => {
    await environment.stop();
  }, 30000);

  describe('RemoveRoleFromMembership Command', () => {
    it('should remove role from membership', async () => {
      // 1. Create tenant
      tenantId = uuidv7();
      await environment.commandService.post('/commands/create-tenant', {
        tenantId,
        name: 'Test Tenant',
        namespace: `ns-${tenantId.slice(0, 8)}`,
      });

      // 2. Create role
      roleId = uuidv7();
      await environment.commandService.post('/commands/create-role', {
        roleId,
        tenantId,
        name: 'Editor',
        permissionKeys: ['content.edit'],
      });

      // 3. Create user
      userId = uuidv7();
      await environment.commandService.post('/commands/register-user', {
        userId,
        email: `user-${userId.slice(0, 8)}@test.com`,
        password: 'password123',
        firstName: 'John',
        lastName: 'Doe',
      });

      // 4. Create membership
      membershipId = uuidv7();
      const createMembershipRes = await environment.commandService.post(
        '/commands/create-membership',
        {
          membershipId,
          userId,
          tenantId,
        }
      );
      expect(createMembershipRes.status).toBe(202);

      // Wait for projection
      await environment.waitForCheckpoint(
        'MembershipProjector',
        createMembershipRes.data.streamVersion
      );

      // 5. Assign role to membership
      const assignRoleRes = await environment.commandService.post(
        '/commands/assign-role-to-membership',
        {
          membershipId,
          roleId,
        }
      );
      expect(assignRoleRes.status).toBe(202);

      // Wait for projection
      await environment.waitForCheckpoint(
        'MembershipProjector',
        assignRoleRes.data.streamVersion
      );

      // Verify role assigned
      let queryRes = await environment.queryService.get(
        `/memberships/${membershipId}`
      );
      expect(queryRes.status).toBe(200);
      expect(queryRes.data.roleIds).toContain(roleId);

      // 6. Remove role from membership
      const removeRoleRes = await environment.commandService.post(
        '/commands/remove-role-from-membership',
        {
          membershipId,
          roleId,
        }
      );
      expect(removeRoleRes.status).toBe(202);

      // Wait for projection
      await environment.waitForCheckpoint(
        'MembershipProjector',
        removeRoleRes.data.streamVersion
      );

      // 7. Verify role removed
      queryRes = await environment.queryService.get(
        `/memberships/${membershipId}`
      );
      expect(queryRes.status).toBe(200);
      expect(queryRes.data.roleIds).not.toContain(roleId);
    });

    it('should handle removing non-existent role gracefully', async () => {
      // Setup: Create tenant, user, membership
      tenantId = uuidv7();
      await environment.commandService.post('/commands/create-tenant', {
        tenantId,
        name: 'Test Tenant',
        namespace: `ns-${tenantId.slice(0, 8)}`,
      });

      userId = uuidv7();
      await environment.commandService.post('/commands/register-user', {
        userId,
        email: `user-${userId.slice(0, 8)}@test.com`,
        password: 'password123',
        firstName: 'Jane',
        lastName: 'Smith',
      });

      membershipId = uuidv7();
      const createRes = await environment.commandService.post(
        '/commands/create-membership',
        {
          membershipId,
          userId,
          tenantId,
        }
      );
      await environment.waitForCheckpoint(
        'MembershipProjector',
        createRes.data.streamVersion
      );

      // Try to remove role that was never assigned
      const nonExistentRoleId = uuidv7();
      const removeRes = await environment.commandService.post(
        '/commands/remove-role-from-membership',
        {
          membershipId,
          roleId: nonExistentRoleId,
        }
      );

      // Should either succeed (idempotent) or return appropriate error
      expect([202, 400, 404]).toContain(removeRes.status);
    });

    it('should handle multiple role assignments and removals', async () => {
      // 1. Setup tenant, user, membership
      tenantId = uuidv7();
      await environment.commandService.post('/commands/create-tenant', {
        tenantId,
        name: 'Test Tenant',
        namespace: `ns-${tenantId.slice(0, 8)}`,
      });

      userId = uuidv7();
      await environment.commandService.post('/commands/register-user', {
        userId,
        email: `user-${userId.slice(0, 8)}@test.com`,
        password: 'password123',
        firstName: 'Multi',
        lastName: 'Role',
      });

      membershipId = uuidv7();
      const createRes = await environment.commandService.post(
        '/commands/create-membership',
        {
          membershipId,
          userId,
          tenantId,
        }
      );
      await environment.waitForCheckpoint(
        'MembershipProjector',
        createRes.data.streamVersion
      );

      // 2. Create multiple roles
      const role1Id = uuidv7();
      await environment.commandService.post('/commands/create-role', {
        roleId: role1Id,
        tenantId,
        name: 'Role1',
        permissionKeys: ['perm1'],
      });

      const role2Id = uuidv7();
      await environment.commandService.post('/commands/create-role', {
        roleId: role2Id,
        tenantId,
        name: 'Role2',
        permissionKeys: ['perm2'],
      });

      const role3Id = uuidv7();
      await environment.commandService.post('/commands/create-role', {
        roleId: role3Id,
        tenantId,
        name: 'Role3',
        permissionKeys: ['perm3'],
      });

      // 3. Assign all roles
      let res = await environment.commandService.post(
        '/commands/assign-role-to-membership',
        { membershipId, roleId: role1Id }
      );
      await environment.waitForCheckpoint(
        'MembershipProjector',
        res.data.streamVersion
      );

      res = await environment.commandService.post(
        '/commands/assign-role-to-membership',
        { membershipId, roleId: role2Id }
      );
      await environment.waitForCheckpoint(
        'MembershipProjector',
        res.data.streamVersion
      );

      res = await environment.commandService.post(
        '/commands/assign-role-to-membership',
        { membershipId, roleId: role3Id }
      );
      await environment.waitForCheckpoint(
        'MembershipProjector',
        res.data.streamVersion
      );

      // Verify all assigned
      let query = await environment.queryService.get(
        `/memberships/${membershipId}`
      );
      expect(query.data.roleIds).toContain(role1Id);
      expect(query.data.roleIds).toContain(role2Id);
      expect(query.data.roleIds).toContain(role3Id);

      // 4. Remove middle role
      res = await environment.commandService.post(
        '/commands/remove-role-from-membership',
        { membershipId, roleId: role2Id }
      );
      await environment.waitForCheckpoint(
        'MembershipProjector',
        res.data.streamVersion
      );

      // Verify role2 removed, others remain
      query = await environment.queryService.get(
        `/memberships/${membershipId}`
      );
      expect(query.data.roleIds).toContain(role1Id);
      expect(query.data.roleIds).not.toContain(role2Id);
      expect(query.data.roleIds).toContain(role3Id);
    });
  });
});
