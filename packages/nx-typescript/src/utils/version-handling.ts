import { ExecutorContext } from '@nx/devkit';
import { existsSync } from 'fs';
import { join } from 'path';
import { readFileSync, writeFileSync } from 'fs';
import * as semver from 'semver';
import { IPublishExecutorOptions } from '../executors/publish/publish';

/**
 * Minimal shape for package.json used by the executor.
 */
export interface IPackageJson {
  name?: string;
  version?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  [key: string]: unknown;
}

/**
 * Read and parse a package.json file from disk.
 *
 * @param {string} packageJsonPath - Absolute path to package.json file.
 * @returns {IPackageJson} Parsed package.json object.
 * @throws Will throw if the file cannot be read or parsed.
 */
export function readPackageJson(packageJsonPath: string): IPackageJson {
  const content = readFileSync(packageJsonPath, 'utf-8');
  return JSON.parse(content) as IPackageJson;
}

/**
 * Write a package.json object to disk with stable formatting.
 *
 * @param {string} packageJsonPath - Absolute path to package.json file.
 * @param {IPackageJson} pkg - Package JSON object to write.
 */
export function writePackageJson(
  packageJsonPath: string,
  pkg: IPackageJson
): void {
  const formatted = JSON.stringify(pkg, null, 2) + '\n';
  writeFileSync(packageJsonPath, formatted, { encoding: 'utf-8' });
}

/**
 * Get the valid version string based on options.
 */
export function getValidVersion(
  options: IPublishExecutorOptions,
  context: ExecutorContext,
  packageJsonPath: string
): string {
  let validVersion: string;

  if (options.syncRepoVersion) {
    // Read version from root package.json
    const rootPackageJsonPath = join(context.root, 'package.json');
    if (!existsSync(rootPackageJsonPath)) {
      throw new Error(`Root package.json not found at ${rootPackageJsonPath}`);
    }
    const rootPackageJson = readPackageJson(rootPackageJsonPath);
    if (
      !rootPackageJson.version ||
      typeof rootPackageJson.version !== 'string'
    ) {
      throw new Error('Version not found in root package.json');
    }
    validVersion = rootPackageJson.version;
  } else {
    // Use version from project package.json
    const packageJson = readPackageJson(packageJsonPath);
    if (!packageJson.version || typeof packageJson.version !== 'string') {
      throw new Error('Version not found in package.json');
    }
    validVersion = packageJson.version;
  }

  // Validate semver
  if (!semver.valid(validVersion)) {
    throw new Error(`Invalid semver version: ${validVersion}`);
  }

  return validVersion;
}

/**
 * Determine the npm tag based on version.
 */
export function determineTag(version: string): string {
  const parsed: semver.SemVer | null = semver.parse(version);
  return parsed && parsed.prerelease && parsed.prerelease.length > 0
    ? String(parsed.prerelease[0])
    : 'latest';
}

/**
 * Update the package.json with the given version.
 */
export function updatePackageVersion(
  packageJsonPath: string,
  version: string
): IPackageJson {
  const packageJson = readPackageJson(packageJsonPath);
  packageJson.version = version;
  writePackageJson(packageJsonPath, packageJson);
  return packageJson;
}
