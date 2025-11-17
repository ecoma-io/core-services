import { Module } from '@nestjs/common';
import { PermissionMergeService } from './permission-merge.service';
import { UserPermissionService } from './user-permission.service';
import { PermissionCacheModule } from '../cache/permission-cache.module';
import { ReadModelModule } from '../read-models/read-model.module';

/**
 * Permission Module
 * Provides permission merging and expansion services
 *
 * @see ADR-5 in docs/iam/architecture.md
 */
@Module({
  imports: [PermissionCacheModule, ReadModelModule],
  providers: [PermissionMergeService, UserPermissionService],
  exports: [PermissionMergeService, UserPermissionService],
})
export class PermissionModule {}
