import isCI from 'is-ci';
import { getJestProjectsAsync } from '@nx/jest';

/**
 * Generates the Jest configuration for the Nx monorepo.
 * @remarks This function asynchronously retrieves Jest projects, filters out e2e configurations, and returns a configuration object with CI settings and coverage reporters.
 * @returns {Promise<Config>} The Jest configuration object containing projects, CI flag, and coverage reporters.
 */
export default async function generateJestConfig() {
  try {
    const projects = (await getJestProjectsAsync()).filter(
      (project) => !project.endsWith('jest-e2e.config.mjs')
    );

    return {
      projects,
      ci: Boolean(isCI),
      coverageReporters: ['text', 'lcov', 'html', 'json'],
    };
  } catch (error) {
    throw new Error(
      `Failed to generate Jest configuration: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}
