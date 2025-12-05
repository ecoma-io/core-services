/**
 * Jest preset configuration for Ecoma Core Services monorepo.
 *
 * @remarks
 * This preset is shared across all projects in the workspace and provides
 * consistent test configuration, coverage settings, and CI optimization.
 *
 * Key features:
 * - Extends Nx's default Jest preset for monorepo support
 * - Configures ts-jest for TypeScript transformation
 * - Optimizes worker count for CI environments
 * - Excludes index files and test files from coverage reporting
 */

const nxPreset = require('@nx/jest/preset').default;
const { isCI } = require('is-ci');

module.exports = {
  // Extend Nx's default Jest configuration
  ...nxPreset,

  // Test environment configuration
  testEnvironment: 'node',
  passWithNoTests: true,

  // CI/CD optimizations
  ci: isCI,
  maxWorkers: isCI ? 1 : undefined,

  // TypeScript transformation configuration
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },

  // Module resolution
  moduleFileExtensions: ['ts', 'js'],

  // Coverage configuration
  collectCoverageFrom: ['<rootDir>/src/**/*.ts'],
  coverageDirectory: 'coverage',
  coverageReporters: ['json', 'html', 'text', 'lcov'],
  coveragePathIgnorePatterns: ['(.*)/index.ts$', '(.*)/.{spec|test|d}.ts$'],
};
