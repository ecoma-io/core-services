async function getConfig() {
  const {
    default: {
      utils: { getProjects },
    },
  } = await import('@commitlint/config-nx-scopes');

  return {
    extends: ['@commitlint/config-angular'],
    rules: {
      // Subject (header) max length: allow up to 100 characters
      'header-max-length': [2, 'always', 100],
      // Allowed commit types (note: 'ci' type is removed, use 'chore(ci):' instead)
      // - build: Changes that affect the build system or external dependencies
      // - chore: Maintenance tasks, dependency updates, tooling
      // - docs: Documentation only changes
      // - feat: A new feature
      // - fix: A bug fix
      // - perf: A code change that improves performance
      // - refactor: A code change that neither fixes a bug nor adds a feature
      // - revert: Reverts a previous commit
      // - style: Changes that do not affect the meaning of the code
      // - test: Adding missing tests or correcting existing tests
      'type-enum': [
        2,
        'always',
        [
          'build',
          'chore',
          'docs',
          'feat',
          'fix',
          'perf',
          'refactor',
          'revert',
          'style',
          'test',
        ],
      ],
      // Allowed scopes:
      // - general: Changes affecting the entire workspace
      // - deps: Dependency updates
      // - ci: CI/CD configuration changes
      // - release: Version bumps, changelogs
      // - <nx-project-name>: Any Nx project (excluding -e2e projects)
      'scope-enum': async (ctx) => [
        2,
        'always',
        [
          'general',
          'deps',
          'ci',
          'release',
          ...getProjects(ctx, ({ name }) => !name.includes('-e2e')),
        ],
      ],
    },
    // . . .
  };
}

module.exports = getConfig();
