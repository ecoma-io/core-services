# Getting Started

## Yêu cầu bắt buộc

Trước khi bắt đầu, bạn nên có:

- VS Code với extension Dev Containers (khuyến nghị)
- Docker đang chạy trên máy (hoặc quyền truy cập Docker daemon từ devcontainer)
- Node.js & pnpm (nếu không dùng devcontainer)

## Mở dự án trong DevContainer

1. Cài extension [Dev Containers](vscode:extension/ms-vscode-remote.remote-containers) trong VS Code.
2. Bấm vào [liên kết này để clone và mở repo trong DevContainer](https://vscode.dev/redirect?url=vscode://ms-vscode-remote.remote-containers/cloneInVolume?url=https://github.com/ecoma-io/core-services).

   hoặc trong VS Code chọn `Dev Containers: Clone Repository in Container Volume...`

3. Chọn branch git (thường là `dev`).

> _Ghi chú_: `Clone Repository in Container Volume` giúp tối ưu hiệu năng làm việc trong container. ([Xem thêm](https://code.visualstudio.com/remote/advancedcontainers/improve-performance#_use-clone-repository-in-container-volume))

Sau khi container được tạo, dependencies của dự án sẽ được cài đặt và các dịch vụ hạ tầng phát triển (MinIO, Postgres, MailDev, Redis, ...) thường sẽ được khởi động.

Truy cập `http://dev.fbi.com`để xem tài liệu dự án và công cụ hỗ trợ.

## Cấu trúc Monorepo & Sử dụng Nx

Repo được tổ chức theo mô hình Nx monorepo. Dưới đây là hướng dẫn ngắn giúp contributors mới nắm nhanh cấu trúc và cách chạy các target Nx phổ biến.

Cấu trúc cao cấp:

- `apps/`: **Application Bootstrap (Entry Points)**.
- `domains`: **Tầng Domain (Core - Trái tim hệ thống)**.
- `interactors`: **Tầng Application (Use Cases)**.
- `adapters`: **Tầng Infrastructure (Implementation)**.
- `e2e/`: Các dự án kiểm thử end-to-end (E2E Tests) cho các ứng dụng trong `apps/`.
- `libs/`: Các các thư viện nội bộ (nội bộ trong monorepo này):
- `packages/`: Thư viện chia sẻ (Shared Libraries) độc lập, có thể publish npm.
- `tools/` & `infras/`: Công cụ DevOps và môi trường Local.
- `docs/`: Tài liệu dự án (ADR, hướng dẫn, kiến trúc, v.v.).

## Shared Packages (Publishable libraries)

This repository contains several shared, publishable packages under `packages/`.
They are intended to be stable, well-reviewed contracts and helpers consumed by
services, frontends, and other TypeScript applications across the organization.

- **`@ecoma-io/common`**: Shared TypeScript types, response shapes and small
  runtime utilities. This package defines REST API contracts (success/error
  response shapes), common exceptions, and small helpers used by services and
  clients (including web/mobile/desktop apps). Treat its exports as public API
  — changes require coordination and version bumps.

- **`@ecoma-io/domain`**: Domain primitives and base classes (Entities, Value
  Objects, Aggregates, Domain Events). Use this package when implementing or
  sharing domain model building blocks across bounded contexts and microservices
  that follow DDD patterns.

- **`@ecoma-io/interactor`**: Application-layer interfaces and ports (Commands,
  Queries, Event/Command handlers, Unit-of-Work, Repository ports). Services and
  adapters should depend on these interfaces to implement use-cases and to keep
  application logic decoupled from infrastructure.

- **`@ecoma-io/nestjs-helpers`**: NestJS bootstrap and presenter helpers —
  configuration validation, global exception filters, validation pipes, and
  health-check utilities. Import this package into `apps/*` `main.ts` and
  shared modules to standardize startup behavior across NestJS services.

Guidance for contributors:

- Prefer additive changes to these packages; avoid breaking changes when
  possible. When a breaking change is necessary, update README, chagnes notes,
  and communicate to downstream teams.
- Use the path alias imports (`@ecoma-io/*`) when consuming these packages from
  other workspace projects.

Mỗi project được khai báo trong `project.json` (hoặc trong workspace config). `targets` chứa các task như `build`, `serve`, `test`, `lint`, `e2e`, `migrate:*`, `docker:build`, `publish`, `up`, `restart`, `reset`, v.v.

Ví dụ `project.json` (minh họa):

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

Chạy các target thường dùng

```bash
# Chạy một target
npx nx run resource-service:build # hoặc npx nx build resource-service
npx nx run resource-service:serve # hoặc npx nx serve resource-service
npx nx run resource-service:test # hoặc npx nx test resource-service
npx nx run resource-service:lint # hoặc npx nx lint resource-service

# Với cấu hình
npx nx run resource-service:build:production
```

Lệnh cho nhiều project

```bash
# Chạy target cho nhiều project
npx nx run-many --target=test --projects=resource-service,other-service
# Build tất cả project
npx nx run-many --target=build --all

# Chỉ chạy project bị ảnh hưởng
npx nx affected:test --base=origin/main --head=HEAD
npx nx affected:build --base=origin/main --head=HEAD

# Hiển thị dependency graph
npx nx dep-graph
```

Best practices

- Chuẩn hóa các target: `build`, `serve`/`start`, `test`, `lint`, `e2e`, `seed`, `docker:build`, `publish`.
- Dùng `nx run-commands` cho script đơn giản và giữ tính idempotent để cache hoạt động tốt.
- Pin Nx trong `devDependencies` để nhất quán giữa dev và CI.
- Dùng `nx affected` và `nx run-many` trong CI để tối ưu thời gian.

## Tùy chọn: Cài certificate tự ký

Để tránh cảnh báo TLS cho domain `*.fbi.com`, bạn có thể cài certificate tự ký lên hệ thống.

### Bước 1: Lấy certificate

```text
infras/infras-core/cert.crt
```

### Bước 2: Cài certificate

#### Trên Windows

1. Double-click `cert.crt` → Install Certificate
2. Chọn "Local Machine" → Next
3. Chọn "Place all certificates in the following store" → Browse
4. Chọn "Trusted Root Certification Authorities" → OK → Next → Finish
5. Khởi động lại trình duyệt

#### Trên macOS

1. Mở Keychain Access
2. Kéo `cert.crt` vào keychain `System`
3. Double-click certificate → Trust → chọn "Always Trust"
4. Xác thực nếu được yêu cầu và khởi động lại trình duyệt

#### Trên Linux (Ubuntu/Debian)

```sh
sudo cp cert.crt /usr/local/share/ca-certificates/ecoma-fbi-com.crt
sudo update-ca-certificates
```

Nếu trình duyệt dùng store riêng (ví dụ Firefox), import certificate trong trình quản lý của trình duyệt.
