import { DomainEventEnvelope } from './domain-event';
import { Snapshot } from './snapshot';

/**
 * Generic AggregateRoot base for event-sourced aggregates.
 */
export abstract class AggregateRoot<State = Record<string, unknown>> {
  protected _state: Partial<State> = {};
  private _uncommittedEvents: DomainEventEnvelope[] = [];
  private _version = 0; // stream version / last applied event position

  /**
   * Apply a single historical event (used during rehydration).
   * Concrete aggregate MUST implement the handler logic.
   */
  protected abstract applyEvent(event: DomainEventEnvelope): void;

  /**
   * Rehydrate aggregate from event history (ordered).
   */
  rehydrateFromHistory(events: DomainEventEnvelope[], version?: number): void {
    for (const e of events) {
      this.applyEvent(e);
      this._version++;
    }
    if (typeof version === 'number') {
      this._version = version;
    }
  }

  /**
   * Rehydrate from snapshot and then apply remaining events.
   */
  rehydrateFromSnapshot(
    snapshot: Snapshot,
    eventsAfter: DomainEventEnvelope[],
    version?: number
  ): void {
    // allow aggregate to restore state from snapshot payload (optional)
    if (isSnapshotRestorable(this)) {
      this.restoreFromSnapshot(snapshot.payload);
    }
    this.rehydrateFromHistory(eventsAfter, version);
  }

  /**
   * Record a new domain event produced by aggregate behaviour.
   * This will both apply the event to in-memory state and add to uncommitted events.
   */
  protected recordEvent(event: DomainEventEnvelope): void {
    this.applyEvent(event);
    this._uncommittedEvents.push(event);
  }

  get uncommittedEvents(): readonly DomainEventEnvelope[] {
    return [...this._uncommittedEvents];
  }

  clearUncommittedEvents(): void {
    this._uncommittedEvents = [];
  }

  get version(): number {
    return this._version;
  }

  /**
   * Optional: aggregates may produce a snapshot payload to speed up rehydration.
   * Concrete aggregates may override to return a Snapshot.payload-compatible object.
   */
  createSnapshotPayload?(): unknown;
}

function isSnapshotRestorable(
  obj: unknown
): obj is { restoreFromSnapshot(payload: unknown): void } {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'restoreFromSnapshot' in obj &&
    typeof (obj as Record<string, unknown>)['restoreFromSnapshot'] ===
      'function'
  );
}
