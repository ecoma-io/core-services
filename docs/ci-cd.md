````markdown
# CI / CD — Continuous Integration and Delivery

This document describes the CI/CD strategy used by the `core-services` repository, how the GitHub Actions workflows operate, what secrets/tokens are required, and recommended local debugging steps. It is written to help contributors understand and troubleshoot the automated pipelines.

**Contents**

- Overview
- Workflows (Integration, Delivery, Analysis)
- Key secrets and environment variables
- How the release / publish flow works
- Running parts of the pipeline locally
- Debugging tips and common failures
- Recommendations and best practices

---

## Overview

This repository uses GitHub Actions to run CI on pushes and pull requests, and to publish packages and Docker images on releases. The CI is optimized using Nx to compute affected projects so tasks (lint, test, build, e2e) run only for projects that changed.

High-level goals of CI/CD in this repo:

- Ensure code quality: linting and unit tests for changed projects
- Run integration and E2E tests where applicable (Testcontainers)
- Build artifacts and Docker images reproducibly
- Publish release artifacts (npm packages, Docker images) from tagged releases
- Run security analysis (CodeQL) on `main`

## Workflows

There are three main GitHub workflows referenced in the docs and repository:

- `integration.yaml` — runs on pushes and PRs to `main` and `dev`. Executes lint, tests, build, and e2e for affected projects and may also prepare release artifacts for `main`.
- `delivery.yaml` — triggers on semver tags (for example `v1.2.3`) and publishes packages/images to registries (GHCR and npm). It authenticates using `GITHUB_TOKEN` and `NPM_TOKEN`.
- `analysis.yaml` — runs CodeQL security analysis on `main` (pushes, PRs, and scheduled).

Note: exact workflow filenames and implementation live under `.github/workflows/`. When reviewing or editing CI, open those files to see precise job steps, matrix definitions, and caching configuration.

### `integration.yaml` (typical responsibilities)

- Trigger: pushes and pull requests to `dev` and `main` (and PR branches depending on repo config).
- Steps:
  - Checkout repository
  - Install Node.js and `pnpm` (the workflows often pin Node and pnpm versions)
  - Install dependencies (`pnpm install` or equivalent)
  - Compute affected projects using `npx nx print-affected` or `nx affected` (compares against `origin/main` or configured base)
  - Run tasks in parallel (lint, unit tests, build, e2e) across affected projects using a matrix strategy
  - Optionally upload artifacts, test reports, and cache dependency layers

Important notes:

- Nx affected detection: CI relies on accurate git references. Ensure the workflow checks out enough history (use `actions/checkout` with `fetch-depth: 0` when needed).
- Caching: workflows typically cache `~/.pnpm-store`, `node_modules/.cache`, and Nx computation caches. When modifying deps or Node versions, invalidate caches appropriately.

### `delivery.yaml` (publishing)

- Trigger: semver Git tag pushes (for example, `v1.2.3`).
- Authentication:
  - `GITHUB_TOKEN` — used to authenticate with GitHub Container Registry (GHCR) to push Docker images.
  - `NPM_TOKEN` — required to publish npm packages to the configured npm registry (often the npmjs.org account or an internal registry).
- Typical steps:
  - Checkout repository and verify tag
  - Authenticate to GHCR (using `GITHUB_TOKEN`) and to npm (using `NPM_TOKEN`)
  - Build packages (e.g., `npx nx run-many -t build --all` or `npx nx run-many -t publish`)
  - Publish packages to npm and push Docker images to GHCR
  - Create GitHub release and update changelog (some repos use `release-please` or similar tooling)

Security considerations:

- Protect `NPM_TOKEN` and limit its scope: create a token with minimal publish privileges, rotate tokens regularly, and store them in repository or organization secrets.
- Use `GITHUB_TOKEN` for GHCR GitHub Actions permissions rather than permanent tokens where possible.

### `analysis.yaml` (CodeQL)

- Runs CodeQL analysis on `main` branch and PRs targeting `main`.
- Ensures security scans run regularly and are reflected in PR checks.

## Key secrets and environment variables

These secrets are required by CI/CD workflows. They should be configured as GitHub repository or organization secrets.

- `NPM_TOKEN`: token to publish packages to npm (or the configured npm registry).
- `GITHUB_TOKEN`: automatically provided by GitHub in Actions — used to authenticate to GHCR and the GitHub REST API.
- Docker-related credentials (if pushing to external registries): `DOCKER_USERNAME`, `DOCKER_PASSWORD` (only if not using GHCR with `GITHUB_TOKEN`).
- Optional: registry-specific tokens (AWS ECR, Docker Hub) if the project publishes there.

Note: keep secrets scoped and minimal. Prefer organization-level secrets when multiple repositories share publishing credentials.

## How the release / publish flow works

1. Prepare a release commit on `main` following Conventional Commits (commit messages with types such as `fix:`, `feat:`, `chore:`, etc.).
2. Tag the commit with a semver tag (for example `git tag v1.2.3 && git push origin v1.2.3`).
3. `delivery.yaml` triggers on the tag push and performs the publishing steps:
   - Builds packages and images
   - Authenticates using secrets
   - Publishes npm packages
   - Pushes Docker images to GHCR or configured registry
   - Creates a GitHub Release (optionally using changelog generated by `release-please` or `conventional-changelog`)

To do a dry-run or debug locally, see the next section.

## Running/Debugging CI steps locally

You can replicate many CI steps locally to debug failures before pushing commits.

1. Install dependencies locally (use same Node version as CI):

```bash
pnpm install
```

2. Compute affected projects (example):

```bash
npx nx print-affected --base=origin/main --target=build --select=projects
```

3. Run the same commands that the workflow runs for a single project:

```bash
npx nx build <project>
npx nx test <project>
npx nx e2e <project>-e2e
```

4. Simulate publish steps (dry-run):

```bash
# Build packages
npx nx run-many --target=build --all

# For npm publish dry-run
cd dist/packages/<package-name>
npm publish --dry-run
```

5. Use Act (optional) to run GitHub Actions locally: https://github.com/nektos/act — helpful for reproducing workflow-level issues but does not perfectly match GitHub-hosted runners (differences in images, services, and permissions).

## Debugging tips and common failures

- Node / pnpm version mismatch: Ensure your local Node/pnpm versions match the versions pinned in the workflow.
- Cache corruption or stale lockfile: Clear pnpm store/cache and re-install: `pnpm store prune && pnpm install --frozen-lockfile`.
- Nx affected mis-detection: Ensure workflows check out enough git history (`fetch-depth: 0`) so `nx` can compare branches.
- E2E failures due to Testcontainers: Ensure Docker daemon is available, Docker has sufficient resources, and the workflows start required infra services.
- Publishing failures:
  - `npm ERR! 403` — `NPM_TOKEN` may lack permission or be invalid.
  - Docker push denied — check registry credentials and that the `GITHUB_TOKEN` has `packages:write` permission if pushing to GHCR.

Collect logs and artifacts:

- Make sure CI uploads test reports, logs, and built artifacts. Download artifacts from the GitHub Actions run for post-mortem analysis.

## Recommendations & best practices

- Use `actions/checkout@v4` with `fetch-depth: 0` for accurate Nx affected detection.
- Pin Node and pnpm versions in workflows, and keep them synchronized with `engines` in `package.json` if present.
- Add `pnpm` and Nx caching keys that include Node version and `pnpm-lock.yaml` checksum to avoid stale caches.
- Add a short `CONTRIBUTING.md` and `RELEASE.md` that document the tagging and release flow for maintainers.
- Add a small CI troubleshooting guide and list of artifacts to collect on failures.

## Dependency updates (Renovate)

This repository uses Renovate (see `.github/renovate.json`) to automate dependency updates. Below is a summary of what Renovate will do with the current configuration and how it interacts with the CI/CD workflows.

- Target branches and scheduling:
  - `baseBranchPatterns: ["dev"]` — Renovate will target branches that match `dev` by default, creating update branches/PRs against `dev`.
  - `schedule: ["after 1am on Monday"]` — most grouped updates are scheduled weekly (Monday). Lockfile maintenance runs on a different schedule: `after 1pm on Tuesday`.

- Branch naming and metadata:
  - `branchPrefix: "update-deps/"` — Renovate creates branches such as `update-deps/your-package-1.x`.
  - PRs are labeled with `labels: ["dependencies"]` and the repo has `dependencyDashboard: true`, so Renovate will also create/maintain a dependency dashboard issue for maintainers.

- Automerge rules and review behavior:
  - `automerge: true` at top-level and packageRules means Renovate will automatically merge certain updates (patch, pin, digest) and some minor updates according to `packageRules`.
  - `major.automerge: false` — major version bumps are never automerged and will require manual review.
  - Specific `packageRules` group important packages (nestjs, types, tooling, nx) and control schedules and automerge behavior per-group.

- Lockfile maintenance:
  - `lockFileMaintenance.enabled: true` — Renovate will create PRs to keep lockfiles up-to-date on the configured schedule. This reduces churn when multiple updates affect the lockfile.

- Grouping rules:
  - Renovate groups updates by package type (e.g., `nestjs-packages`, `types-packages`, `tooling-packages`, `nx-packages`) and applies the schedules and automerge preferences defined in `packageRules`.

How this interacts with CI/CD

- Renovate PRs trigger your normal CI (`integration.yaml`) against the `dev` branch or the created PR branch. This means every Renovate PR will run lint/tests/build/e2e for affected projects and surface failures in CI checks.
- Because Renovate can automerge some updates, you should ensure that the automerged PRs are safe to merge without human review (patches/pins/digests). For anything beyond that (minor/major depending on your config), a manual review is required.
- Since Renovate targets `dev` (per `baseBranchPatterns`), dependency updates flow into the `dev` integration pipeline first; releases and `delivery.yaml` remain gated by tagged releases on `main`.

Recommended actions for maintainers

- Review Renovate PRs in the dependency dashboard and subscribe to notifications for the `dependencies` label.
- Protect `dev` branch with required status checks so automerged changes still pass CI before being merged.
- For grouped PRs that touch many packages, consider splitting or deferring large upgrades to a controlled window.
- Rotate and secure any registry credentials Renovate uses (if Renovate is configured to update Docker/registry credentials or lockfiles that rely on private registries).

Debugging Renovate failures

- Check the Renovate PR body and logs — Renovate gives detailed diagnostics for why an update was created or why merge failed.
- Use the Renovate dependency dashboard (enabled) to see outstanding PRs and groupings.
- If Renovate created a branch but CI failed, re-run CI on the PR after fixing any issues, or adjust the package rule to avoid automerge for that package group.

## Suggested local maintenance commands

```bash
# Clean and reinstall dependencies
pnpm store prune
pnpm install --frozen-lockfile

# Run lint/tests for affected projects against main
npx nx affected --base=origin/main --target=test

# Build all packages (used by delivery pipeline)
npx nx run-many --target=build --all
```

---

If you want, I can:

- Create this file in the repo (I just added it).
- Open a follow-up PR that also adds `docs/RELEASE.md` and a `CONTRIBUTING.md` with publish/tagging steps.
- Add a small `docs/CI-TROUBLESHOOTING.md` with step-by-step reproduction commands for common failures.

Please tell me which follow-up you'd like me to implement.
````
