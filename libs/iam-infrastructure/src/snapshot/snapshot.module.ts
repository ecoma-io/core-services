import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SnapshotEntity } from './snapshot.entity';
import { SnapshotRepository } from './snapshot.repository';
import { SnapshotPolicy } from './snapshot.policy';

/**
 * SnapshotModule (Phase 4.2)
 *
 * Provides snapshot infrastructure for aggregate state optimization.
 * Includes:
 * - SnapshotEntity for persistence
 * - SnapshotRepository for CRUD operations
 * - SnapshotPolicy for determining when to take snapshots
 */
@Module({
  imports: [TypeOrmModule.forFeature([SnapshotEntity])],
  providers: [SnapshotRepository, SnapshotPolicy],
  exports: [SnapshotRepository, SnapshotPolicy],
})
export class SnapshotModule {}
