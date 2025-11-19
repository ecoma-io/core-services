# CI / CD — Tích hợp và Phát hành Liên tục

Tài liệu này mô tả chiến lược CI/CD mà repo `core-services` đang sử dụng, cách các workflow GitHub Actions hoạt động, các bí mật/credential cần thiết và các bước gợi ý để gỡ lỗi cục bộ. Mục tiêu là giúp đóng góp viên hiểu và xử lý sự cố trong pipeline tự động.

## Tổng quan

Repository sử dụng GitHub Actions để chạy CI trên các push và pull request, và để publish package và Docker image khi có release. CI được tối ưu hóa bằng Nx để tính toán các project bị ảnh hưởng (affected projects) nên các tác vụ (lint, test, build, e2e) chỉ chạy cho những project thay đổi.

Mục tiêu cao cấp của CI/CD trong repo này:

- **Đảm bảo chất lượng code:** lint và unit test cho các project thay đổi
- **Chạy integration/E2E khi cần:** dùng Testcontainers cho môi trường kiểm thử
- **Xây dựng artifacts và Docker images có thể tái tạo**
- **Publish artifacts khi có release:** npm packages và Docker images
- **Chạy phân tích bảo mật (CodeQL)** trên nhánh `main`

## Các workflow

Có ba workflow chính được tham chiếu trong tài liệu và repository:

- `integration.yaml` — chạy trên push và PR tới `main` và `dev`. Thực hiện lint, test, build và e2e cho các project bị ảnh hưởng và có thể chuẩn bị artifacts cho release trên `main`.
- `delivery.yaml` — kích hoạt khi có tag semver (ví dụ `v1.2.3`) và publish packages/images lên registry (GHCR, npm). Xác thực bằng `GITHUB_TOKEN` và `NPM_TOKEN`.
- `analysis.yaml` — chạy CodeQL trên `main` (push, PR, scheduled).

File workflow nằm trong `.github/workflows/`. Khi chỉnh sửa CI, mở các file đó để xem chi tiết job, matrix và cấu hình cache.

### `integration.yaml` (trách nhiệm chính)

- Trigger: pushes và pull request tới `dev` và `main` (hoặc theo cấu hình repo).
- Các bước chính:
  - Checkout repository
  - Cài Node.js và `pnpm` (thường pin phiên bản)
  - Cài phụ thuộc (`pnpm install`)
  - Tính các project bị ảnh hưởng bằng `npx nx print-affected` hoặc `nx affected`
  - Chạy song song các tác vụ (lint, unit test, build, e2e) cho các project bị ảnh hưởng
  - Tùy chọn: upload artifacts, test reports, cache

Lưu ý quan trọng:

- Nx affected cần git history chính xác — đảm bảo workflow checkout đủ lịch sử (dùng `actions/checkout` với `fetch-depth: 0`).
- Cache: workflow thường cache `~/.pnpm-store`, `node_modules/.cache`, và Nx computation cache. Khi thay đổi dependency hoặc Node version, hãy invalidate cache phù hợp.

### `delivery.yaml` (phát hành)

- Trigger: push tag semver (ví dụ `v1.2.3`).
- Xác thực:
  - `GITHUB_TOKEN` — dùng để authenticate với GHCR để push image.
  - `NPM_TOKEN` — để publish npm packages.
- Các bước điển hình:
  - Checkout và verify tag
  - Authenticate với GHCR (bằng `GITHUB_TOKEN`) và npm (bằng `NPM_TOKEN`)
  - Build packages (vd: `npx nx run-many --target=build --all`)
  - Publish packages lên npm và push Docker image lên GHCR
  - Tạo GitHub Release và cập nhật changelog (có thể dùng `release-please` hoặc `conventional-changelog`)

Bảo mật:

- Bảo vệ `NPM_TOKEN` và giới hạn scope: tạo token có quyền tối thiểu, xoay token định kỳ và lưu trong GitHub Secrets.
- Ưu tiên dùng `GITHUB_TOKEN` cho GHCR thay vì token cố định.

### `analysis.yaml` (CodeQL)

- Chạy CodeQL analysis trên nhánh `main` và PR targeting `main`.
- Đảm bảo quét bảo mật được thực hiện định kỳ và hiện trong checks của PR.

## Các secrets và biến môi trường chính

Các secrets sau cần cấu hình trong GitHub repository/org secrets:

- `NPM_TOKEN`: token để publish package lên npm (hoặc registry cấu hình)
- `GITHUB_TOKEN`: do GitHub cung cấp trong Actions — dùng để authenticate với GHCR và GitHub API
- Nếu push tới registry khác: `DOCKER_USERNAME`, `DOCKER_PASSWORD`
- Tùy chọn: token cho registry cụ thể (AWS ECR, Docker Hub) nếu cần

Luôn giữ secrets ở phạm vi nhỏ nhất và ưu tiên secrets ở cấp tổ chức khi nhiều repo dùng chung.

## Quy trình phát hành / publish

1. Chuẩn bị commit release trên `main` theo Conventional Commits (`fix:`, `feat:`, `chore:`, ...).
2. Tag commit bằng semver: `git tag v1.2.3 && git push origin v1.2.3`.
3. `delivery.yaml` sẽ chạy trên tag push và thực hiện:

- Build artifacts
- Xác thực bằng secrets
- Publish npm packages
- Push Docker images lên registry
- Tạo GitHub Release và cập nhật changelog

## Chạy/gỡ lỗi CI trên máy local

Các bước để tái tạo một số bước CI trên local:

1. Cài dependencies (dùng cùng phiên bản Node như CI):

```bash
pnpm install
```

2. Tính các project bị ảnh hưởng (ví dụ):

```bash
npx nx print-affected --base=origin/main --target=build --select=projects
```

3. Chạy lệnh tương tự workflow cho một project:

```bash
npx nx run-many -t lint test build e2e <project>
```

4. Mô phỏng publish (dry-run):

```bash
npx nx run-many -t publish --dryRun
```

## Cập nhật dependency (Renovate)

Repo sử dụng Renovate để tự động cập nhật dependency. Tóm tắt cách tác động tới CI/CD:

- Renovate target nhánh `dev` (theo config) và tạo PR theo lịch (ví dụ: hàng tuần).
- Renovate có thể automerge một số cập nhật (patch/pin) theo `packageRules`.
- Lockfile maintenance được bật để giữ lockfile luôn mới.

Recomendation: bảo vệ nhánh `dev` bằng required checks để automerged PR vẫn phải qua CI.

## Lệnh bảo trì local gợi ý

```bash
# Dọn và cài lại dependencies
pnpm store prune
pnpm install --frozen-lockfile

# Chạy lint/tests cho các project bị ảnh hưởng
npx nx affected --base=origin/main --target=test

# Build tất cả packages (dùng khi publish)
npx nx run-many --target=build --all
```

## Đọc thêm

- [ADR-G1 — Monorepo với Nx và DevContainers](adr/ADR-G1.md)
