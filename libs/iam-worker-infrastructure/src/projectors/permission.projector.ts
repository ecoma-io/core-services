import { Injectable, Logger } from '@nestjs/common';
import { DomainEventEnvelope } from '@ecoma-io/domain';
import { BaseProjector } from '../lib/base-projector';
import type { CheckpointRepositoryImpl } from '../lib/checkpoint.repository';
import type { UpcasterRegistryImpl } from '../lib/upcaster.registry';
import type { RabbitMqAdapter } from '../lib/adapters/rabbitmq-adapter';
import {
  PermissionMergeService,
  CombinedPermissionCacheRepository,
  ServiceDefinitionReadRepository,
  PermissionCacheRepository,
  PermissionNode,
} from '@ecoma-io/iam-infrastructure';

/**
 * Projector for permission merging
 * Listens to ServiceVersionRegistered events and merges 3 latest major versions
 *
 * **Flow:**
 * 1. Listen ServiceVersionRegistered event
 * 2. Load all versions for that service from ServiceDefinitionEntity
 * 3. Call PermissionMergeService to merge top 3 major versions
 * 4. Save merged tree to PostgreSQL (CombinedPermissionCacheEntity)
 * 5. Update Redis cache (permission:combined-tree)
 * 6. Invalidate user permission caches (they need rebuild with new tree)
 *
 * @see docs/iam/architecture.md ADR-5
 */
@Injectable()
export class PermissionProjector extends BaseProjector {
  protected readonly projectorName = 'PermissionProjector';
  private readonly logger = new Logger(PermissionProjector.name);

  constructor(
    checkpointRepository: CheckpointRepositoryImpl,
    upcasterRegistry: UpcasterRegistryImpl,
    rabbitMqAdapter: RabbitMqAdapter,
    private readonly mergeService: PermissionMergeService,
    private readonly combinedCacheRepo: CombinedPermissionCacheRepository,
    private readonly serviceDefRepo: ServiceDefinitionReadRepository,
    private readonly permissionCacheRepo: PermissionCacheRepository
  ) {
    super(checkpointRepository, upcasterRegistry, rabbitMqAdapter);
  }

  /**
   * Handle ServiceVersionRegistered event
   *
   * @param event - Domain event envelope
   */
  protected async handleEvent(event: DomainEventEnvelope): Promise<void> {
    if (event.type !== 'ServiceVersionRegistered') {
      return; // Ignore other events
    }

    const { serviceId, version } = event.payload as {
      serviceId: string;
      version: string;
      permissionsTree: PermissionNode[];
    };

    this.logger.log(
      `Processing ServiceVersionRegistered: ${serviceId} v${version}`
    );

    try {
      // Step 1: Load all versions for this service from read model
      const serviceEntity = await this.serviceDefRepo.findById(serviceId);

      if (!serviceEntity) {
        this.logger.warn(
          `Service ${serviceId} not found in read model. Skipping permission merge.`
        );
        return;
      }

      // Step 2: Prepare versions array for merge service
      const versions = serviceEntity.versions.map((v) => ({
        version: v.version,
        permissionsTree: v.permissionsTree as PermissionNode[],
      }));

      this.logger.debug(
        `Found ${versions.length} versions for ${serviceEntity.name}`
      );

      // Step 3: Merge permissions (top 3 major versions)
      const mergeResult = await this.mergeService.mergePermissions(
        serviceEntity.name,
        versions
      );

      this.logger.log(
        `Merged ${mergeResult.mergedVersions.length} versions: ${mergeResult.mergedVersions.map((v) => v.version).join(', ')}`
      );

      // Step 4: Save merged tree to PostgreSQL
      await this.combinedCacheRepo.upsert(
        serviceEntity.name,
        mergeResult.combinedTree,
        mergeResult.mergedVersions,
        mergeResult.resolutionMetadata
      );

      this.logger.debug(
        `Saved merged tree to PostgreSQL for ${serviceEntity.name}`
      );

      // Step 5: Update Redis cache with combined tree
      // All services' trees are merged into a single global tree for permission expansion
      await this.rebuildGlobalCombinedTree();

      // Step 6: Invalidate user permission caches
      // Users need to recalculate permissions with new tree
      await this.invalidateUserPermissionCaches(serviceEntity.name);

      this.logger.log(
        `✅ Permission merge complete for ${serviceEntity.name} v${version}`
      );
    } catch (error) {
      this.logger.error(
        `Failed to process ServiceVersionRegistered for ${serviceId}:`,
        error
      );
      throw error; // Let base projector handle retry/DLQ
    }
  }

  /**
   * Rebuild global combined tree in Redis
   * Merges all services' combined trees into one for permission expansion
   */
  private async rebuildGlobalCombinedTree(): Promise<void> {
    const allCombinedTrees = await this.combinedCacheRepo.findAll();

    // Merge all services' trees into one global tree
    const globalTree: PermissionNode[] = [];
    const servicesMetadata: Record<string, string[]> = {};

    for (const cached of allCombinedTrees) {
      // Each service's tree is a root-level node with service name as key
      globalTree.push({
        key: cached.serviceName,
        description: `Permissions for ${cached.serviceName}`,
        children: cached.combinedTree,
        metadata: {
          resolvedFrom: cached.mergedVersions[0]?.version,
          reason: 'service-root',
        },
      });

      servicesMetadata[cached.serviceName] = cached.mergedVersions.map(
        (v) => v.version
      );
    }

    // Save to Redis
    await this.permissionCacheRepo.setCombinedTree(globalTree);

    this.logger.debug(
      `Rebuilt global combined tree with ${allCombinedTrees.length} services`
    );
  }

  /**
   * Invalidate user permission caches when service permissions change
   * This forces re-calculation of user permissions with new tree
   *
   * TODO: Implement more granular invalidation (only users with roles using this service)
   */
  private async invalidateUserPermissionCaches(
    serviceName: string
  ): Promise<void> {
    this.logger.warn(
      `Invalidating user permission caches for service ${serviceName} - not implemented yet`
    );

    // TODO: Phase 1 Sprint 1.2
    // 1. Find all roles that have permissions from this service
    // 2. Find all users with those roles
    // 3. Delete Redis keys: user_perms:{userId}:{tenantId}
    // 4. UserPermissionProjector will rebuild on next access
  }

  /**
   * Subscribe to RabbitMQ queue for this projector
   * Called by NestJS module on initialization
   */
  async subscribe(): Promise<void> {
    await this.rabbitMqAdapter.subscribe(
      'iam.events.service', // Queue name
      'iam.events.ServiceVersionRegistered', // Routing key
      async (event: DomainEventEnvelope) => {
        await this.handleEventWithCheckpoint(event);
      }
    );

    this.logger.log('✅ PermissionProjector subscribed to RabbitMQ');
  }
}
