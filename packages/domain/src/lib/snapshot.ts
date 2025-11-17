/**
 * Snapshot representation for aggregates persisted in event-sourced stores.
 */
export interface Snapshot<Payload = unknown> {
  readonly aggregateId: string;
  readonly lastEventPosition: number; // position / stream version up to which snapshot represents state
  readonly snapshotVersion: string; // snapshot schema version (for upcasting)
  readonly createdAt: string; // ISO timestamp
  readonly payload: Payload;
}
