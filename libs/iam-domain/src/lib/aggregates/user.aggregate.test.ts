import { UserAggregate } from './user.aggregate';

describe('UserAggregate', () => {
  test('register() emits UserRegistered event', () => {
    // Arrange
    const userId = 'user-1';
    const aggregate = new UserAggregate(userId);

    // Act
    aggregate.register('alice@example.com', 'StrongP@ss123', {
      firstName: 'Alice',
    });

    // Assert
    const events = aggregate.uncommittedEvents;
    expect(events).toHaveLength(1);
    const ev = events[0];
    expect(ev.type).toBe('UserRegistered');
    expect((ev.payload as any).email).toBe('alice@example.com');
  });

  test('rehydrateFromHistory applies events and updates version', () => {
    // Arrange
    const userId = 'user-2';
    const aggregate = new UserAggregate(userId);
    aggregate.register('bob@example.com', 'SecureP@ss456');
    const events = aggregate.uncommittedEvents;

    // Act
    const restored = new UserAggregate(userId);
    restored.rehydrateFromHistory(Array.from(events));

    // Assert
    expect(restored.version).toBe(events.length);
  });
});
