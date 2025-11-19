import { EventSourcingAggregateRoot } from './event-sourcing-aggregate-root';
import { DomainEvent } from '../events/domain-event';

type Payload = { delta?: number } | { value?: number };

class TestEvent extends DomainEvent<Payload> {
  constructor(props: { aggregateId: string; payload: Payload; type?: string }) {
    super({
      aggregateId: props.aggregateId,
      payload: props.payload,
      type: props.type ?? 'TestEvent',
      version: '1.0.0',
    });
  }
}

class TestAggregate extends EventSourcingAggregateRoot {
  public value = 0;

  public applyEvent(event: DomainEvent): void {
    const payload: any = event.payload as any;
    if (typeof payload.value === 'number') {
      this.value = payload.value;
    }
    if (typeof payload.delta === 'number') {
      this.value += payload.delta;
    }
  }

  public restoreFromSnapshot(payload: unknown): void {
    const p = payload as { value: number };
    this.value = p.value;
  }
}

test('rehydrateFromSnapshot restores snapshot and replays eventsAfter', () => {
  // Arrange
  const agg = new TestAggregate();
  const snapshot = {
    aggregateId: agg.id,
    lastEventPosition: 5,
    snapshotVersion: '1',
    createdAt: new Date().toISOString(),
    payload: { value: 10 },
  };
  const eventsAfter = [
    new TestEvent({ aggregateId: agg.id, payload: { delta: 1 } }),
    new TestEvent({ aggregateId: agg.id, payload: { delta: 2 } }),
  ];

  // Act
  agg.rehydrateFromSnapshot(snapshot as any, eventsAfter, undefined);

  // Assert
  expect(agg.value).toBe(13);
  expect(agg.version).toBe(7); // snapshot.lastEventPosition + eventsAfter.length
  expect(agg.getDomainEvents().length).toBe(0);
});

test('markEventsCommitted updates version and clears uncommitted events', () => {
  // Arrange
  const agg = new TestAggregate();

  // Act: apply and record two events
  agg['applyAndRecordEvent'](
    new TestEvent({ aggregateId: agg.id, payload: { delta: 1 } })
  );
  agg['applyAndRecordEvent'](
    new TestEvent({ aggregateId: agg.id, payload: { delta: 2 } })
  );

  // Pre-assert
  expect(agg.getDomainEvents().length).toBe(2);
  const prevVersion = agg.version;

  // Commit without explicit position
  agg.markEventsCommitted();

  // Assert
  expect(agg.getDomainEvents().length).toBe(0);
  expect(agg.version).toBe(prevVersion + 2);
});
