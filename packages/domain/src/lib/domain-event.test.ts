import { DomainEvent } from './domain-event';

describe('DomainEvent shape', () => {
  test('creates object matching DomainEvent interface at runtime', () => {
    // Arrange
    const ev: DomainEvent = {
      id: 'e1',
      type: 'T',
      aggregateId: 'a1',
      occurredAt: new Date().toISOString(),
      eventVersion: '1.0.0',
      payload: { x: 1 },
    };

    // Act & Assert
    expect(ev.id).toBe('e1');
    expect(ev.payload).toEqual({ x: 1 });
  });
});
