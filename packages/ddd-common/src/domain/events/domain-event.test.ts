import { DomainEvent } from './domain-event';

class TestEvent extends DomainEvent<{ x: number }> {
  constructor(props: any) {
    super(props);
  }
}

test('DomainEvent sets id and occurredAt when missing and freezes payload', () => {
  // Arrange & Act
  const e = new TestEvent({
    version: '1.0.0',
    type: 't',
    aggregateId: 'a1',
    payload: { x: 1 },
  });

  // Assert
  expect(typeof e.id).toBe('string');
  expect(typeof e.occurredAt).toBe('string');
  expect(Object.isFrozen(e.payload)).toBe(true);
});
