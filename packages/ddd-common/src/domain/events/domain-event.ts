import { uuidv7 } from 'uuidv7';

export interface IDomainEventInitProps<Payload = Record<string, unknown>> {
  id?: string;
  version: string; // semantic version of event payload (e.g. '1.0.0')
  occurredAt?: string; // ISO timestamp
  type: string;
  aggregateId: string;
  payload: Payload;
  metadata?: Record<string, unknown>;
  position?: number; // optional stream position assigned by event store
}

/**
 * Base Domain Event shared across domain modules.
 *
 * @remarks
 * Domain events are immutable data structures representing a fact that occurred
 * in the domain. The constructor generates an id when not provided.
 */
export abstract class DomainEvent<Payload = Record<string, unknown>> {
  public readonly id: string;
  public readonly version: string; // semantic version of event payload (e.g. '1.0.0')
  public readonly occurredAt: string; // ISO timestamp
  public readonly type: string;
  public readonly aggregateId: string;
  public readonly payload: Payload;
  public readonly metadata?: Record<string, unknown>;
  public readonly position?: number; // optional stream position assigned by event store

  /**
   * Construct a new DomainEvent.
   * @param props - Initialization properties for the event.
   */
  protected constructor(props: IDomainEventInitProps<Payload>) {
    this.id = props.id ?? uuidv7();
    this.version = props.version;
    this.occurredAt = props.occurredAt ?? new Date().toISOString();
    this.type = props.type;
    this.aggregateId = props.aggregateId;
    // Freeze payload to discourage accidental mutation by consumers
    // Note: freezing is shallow; if deep immutability is required, pass an already frozen/cloned payload.

    this.payload = Object.freeze(props.payload) as Payload;
    this.metadata = props.metadata;
    this.position = props.position;
  }
}
