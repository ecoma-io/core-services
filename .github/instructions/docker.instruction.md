---
applyTo: '**/*.sh'
description: 'Docker build best practices, security, and performance conventions'
---

## Scope

- **Applies to:** All `Dockerfile` files in the repository, and related Docker build artifacts (e.g., `docker-compose.yml`, CI/CD build stages).
- **Goal:** Optimize image size, accelerate build speed, ensure security, and improve maintainability.

## Mandatory Actions (Mandatory Actions)

### 1. Image Structure & Layering

1.  **Base Image Selection (FROM):**
    - **Choose Minimal Images:** Always opt for small, minimal images. Prioritize **Alpine** or **Slim** variants (e.g., `node:20-slim`, `python:3.11-alpine`) unless a full distribution is strictly necessary for technical reasons.
    - **Pin Versions:** Always pin the base image using a **specific version tag** or a **digest** (e.g., `node:20.10.0-slim`), never use unstable tags (`latest`, `stable`).
2.  **Layer Optimization:**
    - **Ordering:** Place commands that change **least often** toward the **beginning** (e.g., system package installation, foundational libraries) and commands that change **most often** (e.g., copying source code) toward the **end**.
    - **Grouping (Squash):** Use a single `RUN` instruction to group multiple related commands by chaining them with `&&` and ending with `\` (backslash) to reduce the number of layers.

### 2. Security

1.  **Non-Privileged User:**
    - **USER:** Always switch to a non-root user using the `USER` instruction after installing system packages. If the base image doesn't provide one, create a dedicated user and group.
2.  **Resource Cleanup:**
    - **Cleanup:** In the same `RUN` instruction, immediately remove unnecessary files (caches, package lists, temporary files) after installing packages. For example, remove `/var/cache/apt/*` or `$RM_DIR` immediately after `apk add` / `apt-get install`.
3.  **Secrets Management:**
    - **No COPY:** **Never** use `COPY` or `ADD` to introduce secrets, SSH keys, or credentials into the image.
    - **Use BuildKit Secrets:** Leverage BuildKit's `--secret` feature or use multi-stage builds to handle secrets during the build process.

### 3. Files & Working Directory

1.  **Working Directory (WORKDIR):** Use `WORKDIR` to set the working directory. Use absolute paths (e.g., `/usr/src/app`).
2.  **COPY vs ADD:**
    - **Prefer COPY:** Always prefer `COPY` over `ADD`. `ADD` is only permitted when you require automatic local tar file extraction or fetching files from a URL (which should generally be avoided).
3.  **`.dockerignore`:** Always define a `.dockerignore` file to exclude unnecessary files (e.g., `.git`, `node_modules`, `dist`, logs) from the build context.

### 4. Execution and Configuration

1.  **ENTRYPOINT and CMD:**
    - **ENTRYPOINT:** Used to define the main executable program (e.g., `java`, `node`, `python`). It should use the **exec form** (JSON array): `ENTRYPOINT ["/usr/bin/node"]`.
    - **CMD:** Used to provide default arguments for the `ENTRYPOINT`.
2.  **Environment Variables (ENV):**
    - **Scope:** Only define environment variables strictly required for runtime (e.g., ports, logging configuration). Avoid defining variables solely for build time if not necessary.
3.  **Healthcheck:**
    - **HEALTHCHECK:** Add a `HEALTHCHECK` instruction so the container engine (e.g., Docker Swarm, Kubernetes) can monitor the service's health.

## Recommended Examples

### 1. Layer Optimization and Security (Node.js)

```dockerfile
# 1.1 Pin minimal base image version
FROM node:20.10.0-alpine AS builder

# 3.1 Set absolute WORKDIR
WORKDIR /app

# 1.2 Copy least changing files first to leverage caching
COPY package.json package-lock.json ./
# Grouped RUN command for package install
RUN npm ci --omit=dev && npm cache clean --force

# 3.3 Exclusion handled by .dockerignore
COPY . .

# 1.2 Group build commands
RUN npm run build && \
    rm -rf node_modules
    # Cleanup not strictly necessary in a builder stage, but shows the principle

# --- Multi-Stage Build: Optimize runtime image size ---

FROM node:20.10.0-alpine AS production

# 2.1 Switch to non-root user (if available on base image)
# If not available, you must create one: RUN adduser -D appuser && USER appuser
USER node

WORKDIR /app

# 1.2 Copy only necessary files from the 'builder' stage
COPY --from=builder /app/package.json ./
COPY --from=builder /app/package-lock.json ./
COPY --from=builder /app/dist ./dist

# Install runtime dependencies
RUN npm ci --omit=dev && npm cache clean --force

# 4.2 Set port
EXPOSE 3000

# 4.1 ENTRYPOINT in exec form
ENTRYPOINT ["node"]
CMD ["dist/main.js"]

# 4.3 Add Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \

CMD wget -q -O /dev/null http://localhost:3000/health || exit 1
```

### 2. Handling Secrets with BuildKit

```dockerfile
# syntax=docker/dockerfile:1.4
FROM buildpack-deps:bullseye AS builder

# 2.3 Use --mount=type=secret to prevent saving secrets in layers
RUN --mount=type=secret,id=gh_token \
    apt-get update && apt-get install -y git && \
    git clone https://x-oauth-basic:$(cat /run/secrets/gh_token)@[github.com/private/repo.git](https://github.com/private/repo.git)
    # The secret file only exists during the RUN command

# ... COPY necessary files ...

# Then, move to a runtime stage without carrying the secret
FROM debian:stable-slim
# ...
```

## CI/Lint & Tooling

1.  **Linting:**
    - Use **Hadolint** to lint all Dockerfiles. Integrate this step into CI/CD.
    - Command: `hadolint Dockerfile`
2.  **Testing:**
    - Use **Dive** to analyze and inspect image layers post-build for large files or security issues.
3.  **Size Checks:**
    - In CI, add checks to ensure the image size does not exceed an established threshold (e.g., 100MB for the final runtime image).
4.  **BuildKit:**
    - Always use **BuildKit** (via `DOCKER_BUILDKIT=1 docker build ...`) to leverage Multi-Stage Builds, smart caching, and the Secrets feature.
