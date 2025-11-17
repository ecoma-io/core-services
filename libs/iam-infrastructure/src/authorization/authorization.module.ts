import { Module } from '@nestjs/common';
import { AuthorizationService } from './authorization.service';
import { PermissionCacheModule } from '../cache/permission-cache.module';
import { PermissionModule } from '../permissions/permission.module';

/**
 * Authorization Module
 * Provides authorization service for permission checks
 *
 * @see ADR-5 Stage 3 in docs/iam/architecture.md
 */
@Module({
  imports: [PermissionCacheModule, PermissionModule],
  providers: [AuthorizationService],
  exports: [AuthorizationService],
})
export class AuthorizationModule {}
