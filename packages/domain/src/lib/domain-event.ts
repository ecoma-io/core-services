/**
 * Base Domain Event shared across domain modules.
 */
export interface DomainEvent<Payload = Record<string, unknown>> {
  readonly id: string;
  readonly type: string;
  readonly aggregateId: string;
  readonly occurredAt: string; // ISO timestamp
  readonly eventVersion: string; // semantic version of event payload (e.g. '1.0.0')
  readonly payload: Payload;
  readonly metadata?: Record<string, unknown>;
}

export type DomainEventEnvelope<Payload = Record<string, unknown>> =
  DomainEvent<Payload> & {
    readonly position?: number; // optional stream position assigned by event store
  };
