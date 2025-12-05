import nx from '@nx/eslint-plugin';
import importPlugin from 'eslint-plugin-import';

/**
 * ESLint configuration for Ecoma Core Services monorepo.
 *
 * This configuration enforces code quality standards across all projects
 * including TypeScript, JavaScript, and JSON files. It integrates Nx
 * module boundary rules and custom import restrictions.
 */
export default [
  // Apply Nx's recommended base configurations
  ...nx.configs['flat/base'],
  ...nx.configs['flat/typescript'],
  ...nx.configs['flat/javascript'],

  // Ignore build artifacts and dependencies
  {
    ignores: ['**/dist', '**/node_modules/**', '**/coverage/**', '**/tmp/**'],
  },

  // Configuration for TypeScript and JavaScript files
  {
    files: [
      '**/*.ts',
      '**/*.cts',
      '**/*.mts',
      '**/*.js',
      '**/*.cjs',
      '**/*.mjs',
    ],
    plugins: {
      import: importPlugin,
    },
    rules: {
      // Ensure all imports can be resolved
      'import/no-unresolved': 'error',

      // Disallow unused variables except those prefixed with underscore
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],

      // Disallow console statements (use NestJS Logger instead)
      'no-console': 'error',

      // Prevent importing NestJS built-in exceptions
      // Enforce use of custom exceptions from @ecoma-io packages
      'no-restricted-syntax': [
        'error',
        {
          selector: `ImportDeclaration[source.value='@nestjs/common'] > ImportSpecifier[imported.name=/.*Exception$/]`,
          message:
            "Use your application's custom exception classes in @ecoma-io/ecoma-microservices instead of the built-in @nestjs/common Exception classes.",
        },
      ],

      '@typescript-eslint/naming-convention': [
        'error',
        // Enforce interfaces to start with 'I'
        {
          selector: 'interface',
          format: ['PascalCase'],
          prefix: ['I'],
          leadingUnderscore: 'forbid',
          trailingUnderscore: 'forbid',
        },
      ],
      // Enforce Nx module boundaries and dependency constraints.
      // Strict left-to-right layering model (no capability scoping for now):
      // type:e2e -> type:apps -> type:infras -> type:adapters -> type:interactors -> type:domains -> type:libs -> type:packages
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: true,
          depConstraints: [
            // E2E tests may depend on anything to their right (apps, infras, adapters, interactors, domains, libs, packages)
            {
              sourceTag: 'type:e2e',

              onlyDependOnLibsWithTags: [
                'type:apps',
                'type:infras',
                'type:adapters',
                'type:interactors',
                'type:domains',
                'type:libs',
                'type:packages',
              ],
            },

            // Apps may only depend on infras and anything to the right
            {
              sourceTag: 'type:apps',
              onlyDependOnLibsWithTags: [
                'type:infras',
                'type:adapters',
                'type:interactors',
                'type:domains',
                'type:libs',
                'type:packages',
              ],
            },

            // Infras (infrastructure projects) may only depend on adapters and anything to the right
            {
              sourceTag: 'type:infras',
              onlyDependOnLibsWithTags: [
                'type:adapters',
                'type:interactors',
                'type:domains',
                'type:libs',
                'type:packages',
              ],
            },

            // Adapters -> interactors, domains, libs, packages
            {
              sourceTag: 'type:adapters',
              onlyDependOnLibsWithTags: [
                'type:interactors',
                'type:domains',
                'type:libs',
                'type:packages',
              ],
            },

            // Interactors -> domains, libs, packages
            {
              sourceTag: 'type:interactors',
              onlyDependOnLibsWithTags: [
                'type:domains',
                'type:libs',
                'type:packages',
              ],
            },

            // Domains -> libs, packages
            {
              sourceTag: 'type:domains',
              onlyDependOnLibsWithTags: ['type:libs', 'type:packages'],
            },

            // Shared libs -> other libs and packages (allow intra-lib deps)
            {
              sourceTag: 'type:libs',
              onlyDependOnLibsWithTags: ['type:libs', 'type:packages'],
            },

            // Packages -> only other packages
            {
              sourceTag: 'type:packages',
              onlyDependOnLibsWithTags: ['type:packages'],
            },
          ],
        },
      ],
    },
    settings: {
      // Configure import resolver for TypeScript path aliases
      'import/resolver': {
        typescript: {
          extensions: ['.js', '.ts'],
          project: [
            './tsconfig.base.json',
            './apps/*/tsconfig.json',
            './libs/*/tsconfig.json',
          ],
        },
        node: {
          extensions: ['.js', '.ts'],
        },
      },
    },
  },

  // Configuration overrides for test files
  {
    files: [
      '**/*.test.ts',
      '**/*.spec.ts',
      '**/*.test.js',
      '**/*.spec.js',
      '**/*.test.cjs',
      '**/*.spec.cjs',
      '**/*.test.mjs',
      '**/*.spec.mjs',
    ],
    rules: {
      // Allow console statements in tests for debugging
      'no-console': 'off',
      // Allow explicit any types in test mocks
      '@typescript-eslint/no-explicit-any': 'off',
      // Allow empty functions in test stubs
      '@typescript-eslint/empty-function': 'off',
      // Allow empty interfaces in test types
      '@typescript-eslint/empty-interface': 'off',
    },
  },

  // Configuration for JSON files
  {
    files: ['**/*.json'],
    ignores: ['package.json'],
    rules: {
      // Ensure package.json dependencies are properly declared
      '@nx/dependency-checks': ['error'],

      // Enforce that projects have correct 'type' tag keep architecture consistent
      '@nx/workspace-enforce-project-tag-type': ['error'],

      // Prevent hardcoded versions in internal package dependencies (use "*")
      '@nx/workspace-no-specific-internal-deps-version': ['error'],

      // Disallow 'version' field in package.json (except root package.json)
      // Version should be managed centrally at workspace level
      '@nx/workspace-no-package-version': ['error'],

      // Enforce package name follows @ecoma-io/* scope pattern
      '@nx/workspace-enforce-scope': [
        'error',
        {
          pattern: '^@ecoma-io*/.*',
        },
      ],
    },
    languageOptions: {
      parser: await import('jsonc-eslint-parser'),
    },
  },
];
