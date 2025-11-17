import { MembershipAggregate } from './membership.aggregate';

describe('MembershipAggregate', () => {
  test('addToTenant() emits UserAddedToTenant event', () => {
    // Arrange
    const membershipId = 'm-1';
    const userId = 'u-1';
    const tenantId = 't-1';
    const agg = new MembershipAggregate(membershipId);

    // Act
    agg.addToTenant(membershipId, userId, tenantId);

    // Assert
    const events = agg.uncommittedEvents;
    expect(events).toHaveLength(1);
    const ev = events[0];
    expect(ev.type).toBe('UserAddedToTenant');
    expect((ev.payload as any).userId).toBe(userId);
    expect((ev.payload as any).tenantId).toBe(tenantId);
  });

  test('assignRole() after rehydrate emits RoleAssignedToUser event', () => {
    // Arrange
    const membershipId = 'm-2';
    const userId = 'u-2';
    const tenantId = 't-2';
    const agg = new MembershipAggregate(membershipId);
    agg.addToTenant(membershipId, userId, tenantId);
    const history = agg.uncommittedEvents;

    // Act
    const restored = new MembershipAggregate(membershipId);
    restored.rehydrateFromHistory(Array.from(history));
    restored.assignRole('role-1');

    // Assert
    const out = restored.uncommittedEvents;
    expect(out).toHaveLength(1);
    expect(out[0].type).toBe('RoleAssignedToUser');
    expect((out[0].payload as any).roleId).toBe('role-1');
  });
});
