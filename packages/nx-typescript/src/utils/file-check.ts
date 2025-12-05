import { existsSync } from 'fs';

/**
 * Ensure package.json exists at the given path.
 */
export function ensurePackageJsonExists(packageJsonPath: string): void {
  if (!existsSync(packageJsonPath)) {
    throw new Error(`package.json not found at ${packageJsonPath}`);
  }
}
