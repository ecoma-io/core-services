import { Injectable } from '@nestjs/common';

/**
 * SnapshotPolicy (Phase 4.2)
 *
 * Determines when snapshots should be taken based on configurable rules.
 *
 * Policies:
 * - EventCountPolicy: Take snapshot every N events (default: 50)
 * - TimePolicy: Take snapshot if last snapshot is older than T (default: 24h)
 * - HybridPolicy: Combination of both (recommended for production)
 */
@Injectable()
export class SnapshotPolicy {
  private readonly snapshotInterval: number;
  private readonly snapshotMaxAge: number; // in milliseconds

  constructor() {
    // Default policy: snapshot every 50 events
    this.snapshotInterval = parseInt(
      process.env['SNAPSHOT_INTERVAL'] || '50',
      10
    );

    // Default policy: snapshot if older than 24 hours
    this.snapshotMaxAge =
      parseInt(process.env['SNAPSHOT_MAX_AGE_HOURS'] || '24', 10) *
      60 *
      60 *
      1000;
  }

  /**
   * Should a snapshot be taken based on event count?
   *
   * @param currentVersion - Current stream version
   * @param lastSnapshotVersion - Version of last snapshot (or 0 if none)
   * @returns True if snapshot should be taken
   */
  shouldTakeSnapshotByCount(
    currentVersion: number,
    lastSnapshotVersion: number
  ): boolean {
    const eventsSinceLastSnapshot = currentVersion - lastSnapshotVersion;
    return eventsSinceLastSnapshot >= this.snapshotInterval;
  }

  /**
   * Should a snapshot be taken based on age?
   *
   * @param lastSnapshotDate - Date of last snapshot (or null if none)
   * @returns True if snapshot should be taken
   */
  shouldTakeSnapshotByAge(lastSnapshotDate: Date | null): boolean {
    if (!lastSnapshotDate) {
      return true; // No snapshot exists
    }

    const age = Date.now() - lastSnapshotDate.getTime();
    return age >= this.snapshotMaxAge;
  }

  /**
   * Hybrid policy: take snapshot if either condition is met
   *
   * @param currentVersion - Current stream version
   * @param lastSnapshotVersion - Version of last snapshot (or 0 if none)
   * @param lastSnapshotDate - Date of last snapshot (or null if none)
   * @returns True if snapshot should be taken
   */
  shouldTakeSnapshot(
    currentVersion: number,
    lastSnapshotVersion: number,
    lastSnapshotDate: Date | null
  ): boolean {
    return (
      this.shouldTakeSnapshotByCount(currentVersion, lastSnapshotVersion) ||
      this.shouldTakeSnapshotByAge(lastSnapshotDate)
    );
  }

  /**
   * Get snapshot interval for testing/monitoring
   */
  getSnapshotInterval(): number {
    return this.snapshotInterval;
  }

  /**
   * Get snapshot max age for testing/monitoring
   */
  getSnapshotMaxAge(): number {
    return this.snapshotMaxAge;
  }
}
