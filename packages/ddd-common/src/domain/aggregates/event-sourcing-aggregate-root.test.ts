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

class TestAggregate extends EventSourcingAggregateRoot<string> {
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
  expect(agg.getDomainEvents()).toHaveLength(0);
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
  expect(agg.getDomainEvents()).toHaveLength(2);
  const prevVersion = agg.version;

  // Commit without explicit position
  agg.markEventsCommitted();

  // Assert
  expect(agg.getDomainEvents()).toHaveLength(0);
  expect(agg.version).toBe(prevVersion + 2);
});

test('markEventsCommitted with explicit lastCommittedPosition and rehydrateFromHistory override', () => {
  // Arrange
  const agg = new (class extends (EventSourcingAggregateRoot as any) {
    public value = 0;
    public applyEvent(_event: DomainEvent): void {
      // noop
    }
  })();

  // Add domain events via applyAndRecordEvent
  (agg as any).applyAndRecordEvent(
    new (class extends DomainEvent {
      constructor() {
        super({
          version: '1.0.0',
          type: 't',
          aggregateId: (agg as any).id,
          payload: {},
        });
      }
    })()
  );

  expect(agg.getDomainEvents()).toHaveLength(1);

  // Act: mark with explicit position
  agg.markEventsCommitted(42);

  // Assert
  expect(agg.version).toBe(42);
  expect(agg.getDomainEvents()).toHaveLength(0);

  // rehydrateFromHistory with explicit version
  agg.rehydrateFromHistory([], 7);
  expect(agg.version).toBe(7);
});

test('rehydrateFromSnapshot uses explicit version when provided', () => {
  const agg = new TestAggregate();
  const snapshot = {
    aggregateId: agg.id,
    lastEventPosition: 5,
    snapshotVersion: '1',
    createdAt: new Date().toISOString(),
    payload: { value: 1 },
  } as any;
  const after = [new TestEvent({ aggregateId: agg.id, payload: { delta: 1 } })];

  agg.rehydrateFromSnapshot(snapshot, after, 77);
  expect(agg.version).toBe(77);
});

test('updateVersion increments version and rehydrateFromSnapshot falls back to history when no restore', () => {
  // expose updateVersion via subclass
  class Exposed extends (EventSourcingAggregateRoot as any) {
    public applyEvent(_e: DomainEvent): void {
      // noop
    }
    public callUpdate() {
      (this as any).updateVersion();
    }
  }

  const ex = new Exposed();
  expect(ex.version).toBe(-1);
  ex.callUpdate();
  expect(ex.version).toBe(0);

  // Now test rehydrateFromSnapshot fallback branch when restoreFromSnapshot missing
  const noSnap = new (class extends (EventSourcingAggregateRoot as any) {
    public applyEvent(_e: DomainEvent): void {
      // noop
    }
  })();

  const snapshot = {
    aggregateId: noSnap.id,
    lastEventPosition: 5,
    snapshotVersion: '1',
    createdAt: new Date().toISOString(),
    payload: {},
  } as any;

  const eventsAfter = [
    new (class extends DomainEvent {
      constructor() {
        super({
          version: '1.0.0',
          type: 't',
          aggregateId: (noSnap as any).id,
          payload: {},
        });
      }
    })(),
  ];

  // This should call rehydrateFromHistory because restoreFromSnapshot is not defined
  noSnap.rehydrateFromSnapshot(snapshot, eventsAfter as any);
  // started -1, one event -> 0
  expect(noSnap.version).toBe(0);
});
