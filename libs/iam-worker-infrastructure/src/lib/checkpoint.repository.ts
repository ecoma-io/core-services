import { EntityManager } from 'typeorm';

export class CheckpointRepositoryImpl {
  // This implementation expects a SQL table `projection_checkpoints`.
  // Keep this as minimal scaffold; production should use parameterized queries.

  async get(_projectorName: string, _streamId: string): Promise<number | null> {
    // Placeholder: try to read with global DataSource if available.
    // Concrete code will be executed in transaction with provided manager in `save`.
    return null;
  }

  async save(
    manager: EntityManager,
    projectorName: string,
    streamId: string,
    position: number
  ): Promise<void> {
    // upsert checkpoint row
    await manager.query(
      `INSERT INTO projection_checkpoints (projector_name, stream_id, position, updated_at)
       VALUES ($1,$2,$3,now())
       ON CONFLICT (projector_name, stream_id) DO UPDATE SET position = EXCLUDED.position, updated_at = now()`,
      [projectorName, streamId, position]
    );
  }
}

export type CheckpointRepository = CheckpointRepositoryImpl;
