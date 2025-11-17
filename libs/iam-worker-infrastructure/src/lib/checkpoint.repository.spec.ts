import { CheckpointRepositoryImpl } from './checkpoint.repository';

describe('CheckpointRepository', () => {
  test('save executes upsert query using manager', async () => {
    const repo = new CheckpointRepositoryImpl();
    const manager: any = { query: jest.fn().mockResolvedValue(undefined) };

    await repo.save(manager, 'proj', 'stream-1', 42);

    expect(manager.query).toHaveBeenCalled();
    const [sql, params] = manager.query.mock.calls[0];
    expect(sql).toContain('INSERT INTO projection_checkpoints');
    expect(params).toEqual(['proj', 'stream-1', 42]);
  });
});
