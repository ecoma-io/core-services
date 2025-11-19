/**
 * Password Hashing Service
 *
 * @remarks
 * Extends IHasher from @ecoma-io/domain to provide password hashing with
 * Argon2id algorithm and rehash-on-login policy (ADR-IAM-8).
 *
 * Domain layer defines the interface; infrastructure implements with crypto library.
 *
 * @see ADR-IAM-8 — Quyết định Thuật toán Băm Mật khẩu (Password Hashing Algorithm)
 */

import { IAlgorithmMetadata, IHasher } from '@ecoma-io/domain';

/**
 * Argon2 configuration parameters.
 */
export interface IArgon2Config {
  /**
   * Memory cost in KB (default: 65536 = 64MB).
   */
  memoryCost: number;

  /**
   * Number of iterations (default: 3).
   */
  timeCost: number;

  /**
   * Degree of parallelism (default: 4).
   */
  parallelism: number;

  /**
   * Hash length in bytes (default: 32).
   */
  hashLength: number;

  /**
   * Argon2 variant: 'argon2id' (recommended), 'argon2i', 'argon2d'.
   */
  variant: 'argon2id' | 'argon2i' | 'argon2d';
}

/**
 * Password hashing service with rehash policy.
 *
 * Implementation in infrastructure layer using Argon2 library.
 */
export interface IPasswordHashingService extends IHasher {
  /**
   * Hash plaintext password with current production config.
   *
   * @param plaintext - Plaintext password
   * @returns Encoded Argon2id hash (includes salt and params)
   *
   * @remarks
   * Format: $argon2id$v=19$m=65536,t=3,p=4$<salt>$<hash>
   */
  hash(plaintext: string): Promise<string>;

  /**
   * Verify plaintext matches encoded hash.
   *
   * @param encoded - Encoded hash from storage
   * @param plaintext - Plaintext password to verify
   * @returns True if matches
   */
  verify(encoded: string, plaintext: string): Promise<boolean>;

  /**
   * Check if hash uses outdated parameters (needs rehash).
   *
   * @param encoded - Encoded hash to check
   * @returns True if params are below current production config
   *
   * @remarks
   * Domain logic uses this to decide:
   * - If needsRehash() → emit UserPasswordUpgraded event
   * - Rehash happens on successful login (non-blocking)
   */
  needsRehash(encoded: string): boolean;

  /**
   * Extract algorithm metadata from encoded hash.
   *
   * @param encoded - Encoded hash
   * @returns Algorithm name and parameters
   *
   * @remarks
   * Useful for migration tracking and security audits.
   */
  metadata(encoded: string): IAlgorithmMetadata | null;

  /**
   * Get current production configuration.
   *
   * @returns Argon2 config parameters
   *
   * @remarks
   * Used by needsRehash() for comparison.
   */
  getConfig(): IArgon2Config;
}
