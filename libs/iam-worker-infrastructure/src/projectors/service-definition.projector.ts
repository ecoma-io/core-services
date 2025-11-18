import { BaseProjector } from '../lib/base-projector';
import { DomainEventEnvelope } from '@ecoma-io/domain';
import { EntityManager } from 'typeorm';
import { DataSource } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { RabbitMqAdapter } from '../lib/adapters/rabbitmq-adapter';
import { CheckpointRepositoryImpl } from '../lib/checkpoint.repository';
import { UpcasterRegistryImpl } from '../lib/upcaster.registry';

/**
 * ServiceDefinitionProjector - Projects service definition events to read model.
 *
 * Implements ADR-5 Permission Merge Rules:
 * - Keeps top 3 major versions (latest minor/patch of each major)
 * - Older versions are pruned automatically
 * - Merged permission tree computed on demand by query side
 *
 * Events:
 * - ServiceVersionRegistered: Adds new version to service, prunes old versions
 */
@Injectable()
export class ServiceDefinitionProjector extends BaseProjector {
  constructor(
    broker: RabbitMqAdapter,
    ds: DataSource,
    checkpoint: CheckpointRepositoryImpl,
    upcasters: UpcasterRegistryImpl
  ) {
    super(broker, ds, checkpoint, upcasters, 'ServiceDefinitionProjector');
  }

  protected async apply(
    envelope: DomainEventEnvelope,
    manager: EntityManager
  ): Promise<void> {
    switch (envelope.type) {
      case 'ServiceVersionRegistered': {
        await this.handleServiceVersionRegistered(envelope, manager);
        break;
      }
      default:
        // ignore unknown events
        break;
    }
  }

  /**
   * Handle ServiceVersionRegistered event.
   *
   * Strategy:
   * 1. Upsert service definition (create if not exists)
   * 2. Add new version to versions array
   * 3. Prune to keep only top 3 major versions
   */
  private async handleServiceVersionRegistered(
    envelope: DomainEventEnvelope,
    manager: EntityManager
  ): Promise<void> {
    const payload = envelope.payload as {
      serviceId: string;
      version: string;
      permissionsTree: unknown;
      name?: string;
    };
    const { serviceId, version, permissionsTree, name } = payload;
    const publishedAt = envelope.occurredAt;

    // 1. Ensure service exists
    await manager.query(
      `INSERT INTO service_definitions_read_model (service_id, name, versions, created_at)
       VALUES ($1, $2, '[]'::jsonb, now())
       ON CONFLICT (service_id) DO NOTHING`,
      [serviceId, name || serviceId]
    );

    // 2. Add new version to versions array
    await manager.query(
      `UPDATE service_definitions_read_model
       SET versions = versions || $2::jsonb,
           updated_at = now()
       WHERE service_id = $1`,
      [
        serviceId,
        JSON.stringify([
          {
            version,
            permissionsTree,
            publishedAt,
          },
        ]),
      ]
    );

    // 3. Prune to keep top 3 major versions (latest minor/patch of each)
    await this.pruneOldVersions(serviceId, manager);
  }

  /**
   * Prune service versions to keep only top 3 major versions.
   *
   * Algorithm:
   * 1. Parse all versions and group by major version
   * 2. For each major, keep only the latest (by semver comparison)
   * 3. Sort major versions descending, keep top 3
   * 4. Update service with pruned versions array
   */
  private async pruneOldVersions(
    serviceId: string,
    manager: EntityManager
  ): Promise<void> {
    // Fetch current versions
    const result = await manager.query(
      `SELECT versions FROM service_definitions_read_model WHERE service_id = $1`,
      [serviceId]
    );

    if (!result || result.length === 0) return;

    const versions = result[0].versions as Array<{
      version: string;
      permissionsTree: unknown;
      publishedAt: string;
    }>;

    if (versions.length <= 3) return; // No need to prune

    // Group by major version and keep latest of each
    const versionsByMajor = new Map<
      number,
      {
        version: string;
        permissionsTree: unknown;
        publishedAt: string;
        parsed: { major: number; minor: number; patch: number };
      }
    >();

    for (const v of versions) {
      const parsed = this.parseSemver(v.version);
      if (!parsed) continue;

      const existing = versionsByMajor.get(parsed.major);
      if (!existing || this.compareSemver(parsed, existing.parsed) > 0) {
        versionsByMajor.set(parsed.major, { ...v, parsed });
      }
    }

    // Sort major versions descending and keep top 3
    const sortedMajors = Array.from(versionsByMajor.keys()).sort(
      (a, b) => b - a
    );
    const top3Majors = sortedMajors.slice(0, 3);

    const prunedVersions = top3Majors
      .map((major) => {
        const v = versionsByMajor.get(major)!;
        return {
          version: v.version,
          permissionsTree: v.permissionsTree,
          publishedAt: v.publishedAt,
        };
      })
      .sort((a, b) => {
        // Sort by version descending (newest first)
        const aParsed = this.parseSemver(a.version)!;
        const bParsed = this.parseSemver(b.version)!;
        return -this.compareSemver(aParsed, bParsed);
      });

    // Update with pruned versions
    await manager.query(
      `UPDATE service_definitions_read_model
       SET versions = $2::jsonb,
           updated_at = now()
       WHERE service_id = $1`,
      [serviceId, JSON.stringify(prunedVersions)]
    );
  }

  /**
   * Parse semantic version string (major.minor.patch).
   *
   * @returns Parsed version or null if invalid
   */
  private parseSemver(
    version: string
  ): { major: number; minor: number; patch: number } | null {
    const match = version.match(/^(\d+)\.(\d+)\.(\d+)/);
    if (!match) return null;
    return {
      major: parseInt(match[1], 10),
      minor: parseInt(match[2], 10),
      patch: parseInt(match[3], 10),
    };
  }

  /**
   * Compare two semver versions.
   *
   * @returns -1 if a < b, 0 if a == b, 1 if a > b
   */
  private compareSemver(
    a: { major: number; minor: number; patch: number },
    b: { major: number; minor: number; patch: number }
  ): number {
    if (a.major !== b.major) return a.major - b.major;
    if (a.minor !== b.minor) return a.minor - b.minor;
    return a.patch - b.patch;
  }
}
