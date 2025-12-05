import { AggregateRoot } from './aggregate-root';
import { DomainEvent } from '../events';

export interface ISnapshot<Payload = unknown> {
  readonly aggregateId: string;
  readonly lastEventPosition: number; // position / stream version up to which snapshot represents state
  readonly snapshotVersion: string; // snapshot schema version (for upcasting)
  readonly createdAt: string; // ISO timestamp
  readonly payload: Payload;
}

/**
 * AggregateRoot with event-sourcing + snapshot support.
 * Concrete aggregates that need snapshotting should extend this class
 * and implement `createSnapshotPayload()` and `restoreFromSnapshot(payload)` when applicable.
 */
export abstract class EventSourcingAggregateRoot<T> extends AggregateRoot<T> {
  // Version number of committed events
  private _version = -1; // Start version at -1 or 0 for a new AR

  public get version(): number {
    return this._version;
  }

  /**
   * Apply event to state then record as uncommitted.
   */
  protected applyAndRecordEvent(event: DomainEvent): void {
    this.applyEvent(event);
    this.addDomainEvent(event);
  }

  /**
   * Concrete aggregates must implement how events change state.
   */
  public abstract applyEvent(event: DomainEvent): void;

  // Increment version helper
  protected updateVersion(): void {
    this._version++;
  }

  /**
   * Mark current uncommitted events as committed.
   * If `lastCommittedPosition` is provided it will become the new version.
   * Otherwise the version will advance by the number of uncommitted events.
   * This method should be called by the Repository/Infrastructure after
   * events have been persisted and published.
   */
  /**
   * Mark current uncommitted events as committed.
   *
   * @remarks
   * Should be called by the Repository/Infrastructure after events have been persisted
   * and published. If `lastCommittedPosition` is supplied it will be used as the
   * new committed version; otherwise the version advances by the number of committed events.
   *
   * @param lastCommittedPosition - Optional stream position / version assigned by the store.
   */
  public markEventsCommitted(lastCommittedPosition?: number): void {
    const uncommittedCount = this.getDomainEvents().length;
    if (typeof lastCommittedPosition === 'number') {
      this._version = lastCommittedPosition;
    } else if (uncommittedCount > 0) {
      this._version += uncommittedCount;
    }
    this.clearDomainEvents();
  }

  createSnapshotPayload?(): unknown;
  restoreFromSnapshot?(payload: unknown): void;

  public rehydrateFromHistory(events: DomainEvent[], version?: number): void {
    for (const e of events) {
      this.applyEvent(e);
      this._version++;
    }
    if (typeof version === 'number') {
      this._version = version;
    }
    this.clearDomainEvents();
  }

  rehydrateFromSnapshot(
    snapshot: ISnapshot,
    eventsAfter: DomainEvent[],
    version?: number
  ): void {
    if (
      this.restoreFromSnapshot &&
      typeof this.restoreFromSnapshot === 'function'
    ) {
      // Restore state from snapshot payload
      this.restoreFromSnapshot(snapshot.payload);

      // Replay events that occurred after the snapshot so aggregate reaches
      // the expected current state.
      for (const e of eventsAfter) {
        this.applyEvent(e);
        this._version++;
      }

      // If caller provided an explicit version (e.g., repository), use it.
      if (typeof version === 'number') {
        this._version = version;
      } else if (typeof snapshot.lastEventPosition === 'number') {
        // Otherwise, derive a sensible version: snapshot position + replayed events
        this._version = snapshot.lastEventPosition + eventsAfter.length;
      }

      // Clear any uncommitted events after rehydration
      this.clearDomainEvents();
    } else {
      this.rehydrateFromHistory(eventsAfter, version);
    }
  }
}
