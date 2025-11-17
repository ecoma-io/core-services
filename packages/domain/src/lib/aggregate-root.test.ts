import { AggregateRoot } from './aggregate-root';
import { DomainEventEnvelope } from './domain-event';

class TestAggregate extends AggregateRoot<{ count: number }> {
  constructor() {
    super();
    this._state.count = 0;
  }

  protected applyEvent(event: DomainEventEnvelope): void {
    if (event.type === 'Incremented') {
      this._state.count = (this._state.count || 0) + 1;
    }
  }

  increment(): void {
    const ev: DomainEventEnvelope = {
      id: `ev-${Date.now()}`,
      type: 'Incremented',
      aggregateId: 'agg-1',
      occurredAt: new Date().toISOString(),
      eventVersion: '1.0.0',
      payload: {},
    };
    this.recordEvent(ev);
  }
}

describe('AggregateRoot', () => {
  test('recordEvent applies and exposes uncommitted events', () => {
    // Arrange
    const agg = new TestAggregate();

    // Act
    agg.increment();

    // Assert
    const evs = agg.uncommittedEvents;
    expect(evs).toHaveLength(1);
    expect((agg as any)._state.count).toBe(1);
  });

  test('rehydrateFromHistory applies events and sets version', () => {
    // Arrange
    const agg = new TestAggregate();
    agg.increment();
    const history = Array.from(agg.uncommittedEvents);

    // Act
    const restored = new TestAggregate();
    restored.rehydrateFromHistory(history, history.length);

    // Assert
    expect((restored as any)._state.count).toBe(1);
    expect(restored.version).toBe(history.length);
  });
});
