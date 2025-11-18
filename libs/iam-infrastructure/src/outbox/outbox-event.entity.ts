import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

/**
 * OutboxEvent Entity
 *
 * Represents an unpublished or published domain event in the transactional outbox pattern.
 * Ensures at-least-once delivery guarantee by persisting events transactionally with aggregate changes.
 *
 * @see https://microservices.io/patterns/data/transactional-outbox.html
 */
@Entity('outbox_events')
@Index('idx_outbox_unpublished', ['createdAt'], {
  where: 'published_at IS NULL',
})
@Index('idx_outbox_published', ['publishedAt'], {
  where: 'published_at IS NOT NULL',
})
@Index('idx_outbox_retry', ['publishAttempts', 'createdAt'], {
  where: 'published_at IS NULL AND publish_attempts > 0',
})
@Index('idx_outbox_aggregate', ['aggregateId', 'aggregateType'])
export class OutboxEvent {
  /**
   * Unique event ID (matches domain event ID)
   */
  @PrimaryColumn('uuid')
  id!: string;

  /**
   * Aggregate ID that emitted this event
   */
  @Column({ name: 'aggregate_id', type: 'varchar', length: 255 })
  aggregateId!: string;

  /**
   * Aggregate type (e.g., 'Tenant', 'User', 'Role')
   */
  @Column({ name: 'aggregate_type', type: 'varchar', length: 100 })
  aggregateType!: string;

  /**
   * Event type (e.g., 'TenantCreated', 'UserRegistered')
   */
  @Column({ name: 'event_type', type: 'varchar', length: 100 })
  eventType!: string;

  /**
   * Event version (semantic versioning)
   */
  @Column({ name: 'event_version', type: 'varchar', length: 20 })
  eventVersion!: string;

  /**
   * Event payload (serialized as JSON)
   */
  @Column({ type: 'jsonb' })
  payload!: Record<string, unknown>;

  /**
   * Event metadata (causation ID, correlation ID, user ID, etc.)
   */
  @Column({ type: 'jsonb', default: {} })
  metadata!: Record<string, unknown>;

  /**
   * When the event originally occurred (domain event timestamp)
   */
  @Column({ name: 'occurred_at', type: 'timestamp with time zone' })
  occurredAt!: Date;

  /**
   * When the event was successfully published to message bus
   * NULL if not yet published
   */
  @Column({
    name: 'published_at',
    type: 'timestamp with time zone',
    nullable: true,
  })
  publishedAt!: Date | null;

  /**
   * Number of publish attempts (for retry tracking and exponential backoff)
   */
  @Column({ name: 'publish_attempts', type: 'int', default: 0 })
  publishAttempts!: number;

  /**
   * Last error message if publish failed
   */
  @Column({ name: 'last_error', type: 'text', nullable: true })
  lastError!: string | null;

  /**
   * When this outbox record was created
   */
  @Column({
    name: 'created_at',
    type: 'timestamp with time zone',
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt!: Date;
}
