## Prerequisite

## Open project in devcontainer

1. Install the [Dev Containers](vscode:extension/ms-vscode-remote.remote-containers) extension in VS Code.
2. [Click here](https://vscode.dev/redirect?url=vscode://ms-vscode-remote.remote-containers/cloneInVolume?url=https://github.com/ecoma-io/core-services) to check out the project with a devcontainer. Or open VS Code and, from the Command Palette, choose: `Dev Containers: Clone Repository in Container Volume...`.
3. Choose git branch

**Notes**: `Clone Repository in Container Volume` is best to ensure performance. [See more](https://code.visualstudio.com/remote/advancedcontainers/improve-performance#_use-clone-repository-in-container-volume)

After the container is created, the project's dependencies will be installed and the development infrastructure services (MinIO, Postgres, Maildev, Redis, etc.) will be running.

Visit http://dev.fbi.com to view project documentation and other tools:

## Monorepo structure & Nx usage

This repository is organized as an Nx monorepo. Adding a short guide here helps new contributors understand the layout and how to run common Nx targets.

Repository layout (high level):

- `apps/` — application projects (e.g. `resource-service`, `resource-migration`, `resource-e2e`).
- `infras/` — developer infra helpers (docker compose, infra orchestration).
- `libs/` — internal shareable libraries (domain logic, utilities, types).
- `packages/` — publishable packages (DTOs, shared packages for other repos).
- `tools/` — custom scripts, generators, and executors.
- `docs/` — documentation and decision records.

Project declaration

Each project is declared in a `project.json` (or in the workspace config). A project entry contains `root`, `sourceRoot`, `projectType` (`application` or `library`) and a `targets` map. Targets are tasks such as `build`, `serve`, `test`, `lint`, `e2e`, `migrate:*`,`docker:build`,`publish`,`up`,`restart`,`reset` etc.

Example `project.json` snippet (illustrative):

```json
{
  "root": "apps/resource-service",
  "sourceRoot": "apps/resource-service/src",
  "projectType": "application",
  "targets": {
    "build": {
      "executor": "@nrwl/node:build",
      "options": { "outputPath": "dist/apps/resource-service", "main": "apps/resource-service/src/main.ts" }
    },
    "serve": { "executor": "@nrwl/node:execute", "options": { "buildTarget": "resource-service:build" } },
    "test": { "executor": "@nrwl/jest:jest", "options": { "jestConfig": "apps/resource-service/jest.config.mjs" } },
    "lint": { "executor": "@nrwl/linter:eslint", "options": { "lintFilePatterns": ["apps/resource-service/**/*.ts"] } },
    "seed": { "executor": "nx:run-commands", "options": { "commands": ["node ./apps/resource-service/scripts/seed.js"] } }
  }
}
```

Running targets

```bash
# Run a single target
npx nx run resource-service:build # or npx nx build resource-service
npx nx run resource-service:serve # or npx nx serve resource-service
npx nx run resource-service:test # or npx nx test resource-service
npx nx run resource-service:lint # or npx nx lint resource-service

# With configuration
npx nx run resource-service:build:production
```

Multi-project commands

```bash
# Run a target across multiple projects
npx nx run-many --target=test --projects=resource-service,other-service
# Run a target for all projects
npx nx run-many --target=build --all

# Run only affected projects (between branches or commits)
npx nx affected:test --base=origin/main --head=HEAD
npx nx affected:build --base=origin/main --head=HEAD

# Visualize dependency graph
npx nx dep-graph
```

Best practices

- Standardize common targets: `build`, `serve`/`start`, `test`, `lint`, `e2e`, `seed`, `docker:build`,`publish`
- Use `nx run-commands` for simple shell scripts (seed/migrate) and keep tasks idempotent so caching works well.
- Pin Nx in `devDependencies` to ensure consistent behavior across machines and CI.
- Use `nx affected` and `nx run-many` in CI to limit work to changed projects and speed up pipelines.

## Optional: Install a self-signed SSL certificate

This prevents browser warnings for the \*.fbi.com domain used by the development infrastructure so the local environment behaves more like production.

### Step 1: Obtain the certificate

Copy the certificate file from the repository:
infras/infras-core/cert.crt

### Step 2: Install the certificate

#### On Windows

1. Double-click cert.crt
2. Click "Install Certificate"
3. Choose "Local Machine" and click "Next"
4. Select "Place all certificates in the following store" then click "Browse"
5. Choose "Trusted Root Certification Authorities" and click "OK"
6. Click "Next" then "Finish"
7. Restart your browser

#### On macOS

1. Open Keychain Access
2. Drag and drop cert.crt into the "System" keychain
3. Double-click the certificate, expand "Trust", and set "When using this certificate" to "Always Trust"
4. Close the window and authenticate if prompted
5. Restart your browser

#### On Linux (Ubuntu/Debian)

1. Copy the certificate to the system store:

```sh
sudo cp cert.crt /usr/local/share/ca-certificates/ecoma-fbi-com.crt
```

2. Update CA certificates:

```sh
sudo update-ca-certificates
```

3. Restart your browser

If you use a browser that maintains its own certificate store (e.g., some Firefox setups), import the certificate into that browser's certificate manager as well.
