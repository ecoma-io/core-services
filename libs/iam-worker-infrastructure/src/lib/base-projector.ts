import { DataSource, EntityManager } from 'typeorm';
import { DomainEventEnvelope } from '@ecoma-io/domain';

export interface BrokerAdapter {
  subscribe(queue: string, handler: (msg: any) => Promise<void>): Promise<void>;
  close(): Promise<void>;
}

export interface UpcasterRegistry {
  upcast(envelope: DomainEventEnvelope): DomainEventEnvelope;
}

export interface CheckpointRepository {
  get(projectorName: string, streamId: string): Promise<number | null>;
  save(
    manager: EntityManager,
    projectorName: string,
    streamId: string,
    position: number
  ): Promise<void>;
}

export abstract class BaseProjector {
  protected running = false;

  constructor(
    protected readonly broker: BrokerAdapter,
    protected readonly ds: DataSource,
    protected readonly checkpoint: CheckpointRepository,
    protected readonly upcasters: UpcasterRegistry,
    protected readonly projectorName: string
  ) {}

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;
    await this.broker.subscribe(this.projectorName, async (raw) => {
      const envelope = this.upcasters.upcast(raw as DomainEventEnvelope);
      try {
        await this.handleEnvelope(envelope);
      } catch (err) {
        // For scaffold: simple log and rethrow so broker adapter may handle DLQ
        // In production, implement retry/backoff and DLQ logic.
        // eslint-disable-next-line no-console
        console.error('Projector error', err);
        throw err;
      }
    });
  }

  async stop(): Promise<void> {
    if (!this.running) return;
    this.running = false;
    await this.broker.close();
  }

  protected async handleEnvelope(envelope: DomainEventEnvelope): Promise<void> {
    const streamId = envelope.aggregateId;
    const position = envelope.position ?? Date.now();

    await this.ds.transaction(async (manager) => {
      const last = await this.checkpoint.get(this.projectorName, streamId);
      if (last !== null && last >= position) return;
      await this.apply(envelope, manager);
      await this.checkpoint.save(
        manager,
        this.projectorName,
        streamId,
        position
      );
    });
  }

  protected abstract apply(
    envelope: DomainEventEnvelope,
    manager: EntityManager
  ): Promise<void>;
}
