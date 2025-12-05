import { AggregateRoot } from './aggregate-root';
import { DomainEvent } from '../events/domain-event';
import { AggregateRootEventNotProvidedException } from '../exceptions/aggregate-root-no-event-provided.exception';

// Small concrete DomainEvent for tests
class TestDomainEvent extends DomainEvent<{ delta: number }> {
  constructor(props: { aggregateId: string; delta: number }) {
    super({
      aggregateId: props.aggregateId,
      payload: { delta: props.delta },
      type: 'TestDomainEvent',
      version: '1.0.0',
    });
  }
}

class TestAggregate extends AggregateRoot<string> {
  public raiseEvent(delta: number): void {
    const ev = new TestDomainEvent({ aggregateId: this.id, delta });
    this.addDomainEvent(ev);
  }

  /**
   * Helper to force-add a value to the protected `addDomainEvent` method for testing.
   * @param event - Value to forward to `addDomainEvent` (may be invalid/null for negative tests).
   */
  public forceAddDomainEvent(event: unknown): void {
    // Cast to the DomainEvent generic type to call protected implementation
    this.addDomainEvent(event as unknown as DomainEvent<{ delta: number }>);
  }

  public raiseNull(): void {
    // Attempt to add an invalid (null) event and expect validation to occur.
    this.forceAddDomainEvent(null);
  }

  public raiseWrongAggregate(): void {
    const ev = new TestDomainEvent({ aggregateId: 'different-id', delta: 1 });
    this.addDomainEvent(ev);
  }
}

test('addDomainEvent rejects null/undefined', () => {
  // Arrange
  const agg = new TestAggregate();

  // Act & Assert
  expect(() => agg.raiseNull()).toThrow(AggregateRootEventNotProvidedException);
});

test('addDomainEvent rejects events with different aggregateId', () => {
  // Arrange
  const agg = new TestAggregate();

  // Act & Assert
  expect(() => agg.raiseWrongAggregate()).toThrow(
    AggregateRootEventNotProvidedException
  );
});

test('addDomainEvent accepts valid event and store it', () => {
  // Arrange
  const agg = new TestAggregate();

  // Act
  agg.raiseEvent(5);
  const events = agg.getDomainEvents();

  // Assert
  expect(events.length).toBe(1);
  const ev = events[0] as DomainEvent<{ delta: number }>;
  expect(ev.aggregateId).toBe(agg.id);
  expect(ev.payload.delta).toBe(5);
});
