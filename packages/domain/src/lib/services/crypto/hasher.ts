/**
 * Generic hasher abstraction used by domain modules for passwords, tokens
 * and other secrets.
 *
 * @remarks
 * Implementations (Argon2, bcrypt) live in infrastructure adapters.
 */
export interface IAlgorithmMetadata {
  algorithm: string;
  params?: Record<string, unknown>;
}

export interface IHasher {
  /**
   * Hash the given plaintext input and return encoded string.
   */
  hash(plaintext: string): Promise<string>;

  /**
   * Verify plaintext against an encoded hash.
   */
  verify(encoded: string, plaintext: string): Promise<boolean>;

  /**
   * Indicate whether the encoded hash is out of date and should be rehashed.
   */
  needsRehash(encoded: string): boolean;

  /**
   * Extract algorithm metadata from an encoded hash.
   */
  metadata(encoded: string): IAlgorithmMetadata | null;
}
