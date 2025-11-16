# Changelog

## 1.0.0 (2025-11-16)


### Features

* **ci:** replace custom NX_BASE/NX_HEAD logic with nx-set-shas action ([1d2810e](https://github.com/ecoma-io/core-services/commit/1d2810ed43127ae8d1002e9d23d80ae398821c5d))
* **common:** add shared type definitions and utility functions ([ddabc7a](https://github.com/ecoma-io/core-services/commit/ddabc7a784c9566e2dfea491ff394689ae01a7a8))
* **eslint-plugin-monorepo:** add ESLint rules for monorepo packages ([0d6b00e](https://github.com/ecoma-io/core-services/commit/0d6b00ee78bc3084e0b2ba083a2eff3981cb1551))
* **eslint-rules:** add workspace ESLint rules adapter ([3e4c722](https://github.com/ecoma-io/core-services/commit/3e4c7227e1739ce96e5e7775e4397b1e25737cd7))
* **expand-env:** add shell-style variable expansion utility ([507763a](https://github.com/ecoma-io/core-services/commit/507763a42569e2deddb09ffaa17d228223b532dc))
* **general:** add co-pilot instructions and prompts ([ef6b052](https://github.com/ecoma-io/core-services/commit/ef6b0524e02b8fc67e0e56a28cb5fb31f141146b))
* Implement S3 module with multi clients support ([d065d5a](https://github.com/ecoma-io/core-services/commit/d065d5a7d57721dd09d5d7a26192ce986d3c3aa0))
* **infras-core:** add Traefik proxy with dev-infras network ([38e58ca](https://github.com/ecoma-io/core-services/commit/38e58ca2d40cda985a1eeb93ec76f2f0ca4541a4))
* **infras-elastic:** add Elasticsearch development infrastructure ([ce017ac](https://github.com/ecoma-io/core-services/commit/ce017ac3f63fca002b998d3d89fbad374a8b285e))
* **infras-esdb:** add EventStoreDB development infrastructure ([819913a](https://github.com/ecoma-io/core-services/commit/819913a3b64e223f9ede833fa81bc2fd74d5ef3d))
* **infras-maildev:** add email development infrastructure ([23f8ae8](https://github.com/ecoma-io/core-services/commit/23f8ae8004bf294bab7fc36635d2384b2427f596))
* **infras-minio:** add minio for s3 competiable dev infras ([72c9c32](https://github.com/ecoma-io/core-services/commit/72c9c32d5ebd47bbe69484d4143aa1fb02e7bada))
* **infras-mongo:** create mongodb developement infrastructure ([1e340f2](https://github.com/ecoma-io/core-services/commit/1e340f2e077145bce1e451ec7d206b5d842cbd13))
* **infras-postgres:** add postgres development infrastructure ([1cc20c8](https://github.com/ecoma-io/core-services/commit/1cc20c8dc9b0d6a2364a56d6f880fbd5ae4ac39d))
* **infras-rabbitmq:** add rabbitmq development infrastructure ([38c9775](https://github.com/ecoma-io/core-services/commit/38c9775044cf8b424039ea6f00ea6b3738431d03))
* **infras-redis:** add redis development infrastructure ([851f15c](https://github.com/ecoma-io/core-services/commit/851f15c0b91b67381569384103eeb8990f67c812))
* **infras-tools:** add developer tools infrastructure ([63a15de](https://github.com/ecoma-io/core-services/commit/63a15de60bf7dc7d595983a6efcd45dd827118b5))
* **integration-environment:** add base integration testing env with Postgres, Redis, MinIO, and Maildev services ([ec8b8ac](https://github.com/ecoma-io/core-services/commit/ec8b8ac7643f9edf460954ebd215c1bf528d23cf))
* **integration-environment:** add MongoDB, Elasticsearch, RabbitMQ, and EventStoreDB support ([235a18e](https://github.com/ecoma-io/core-services/commit/235a18ef37211f267b259eaaa8d53f7e56908919))
* **integration-hybridize:** add hybrid integration test environment manager ([c9ecc99](https://github.com/ecoma-io/core-services/commit/c9ecc99cef8918ff168ccc0850b4e6da47e651c6))
* **jest-helpers:** add console log stack trace suppressor ([cc058ae](https://github.com/ecoma-io/core-services/commit/cc058ae3bb9a1b7c2348ef985b67d6c7533f364b))
* **nest-exceptions:** add custom HTTP exception classes ([a478914](https://github.com/ecoma-io/core-services/commit/a478914da7b937659500314ba9f1a938eb169576))
* **nestjs-config:** add initial implementation of configuration library with environment variable validation ([2eefafd](https://github.com/ecoma-io/core-services/commit/2eefafd41b4d8a29ece06c87c58df37cec20f89a))
* **nestjs-filters:** add global exception filter for standardize output ([27544e4](https://github.com/ecoma-io/core-services/commit/27544e49335c798f473f7633ccd2667c7d70edd5))
* **nestjs-health:** implement health check module with liveness and readiness route ([bd45591](https://github.com/ecoma-io/core-services/commit/bd455912a1ba208f0b596407ef66df75ec0c9c68))
* **nestjs-pipes:** add global validation pipe with standardized error handling and configuration ([f60f099](https://github.com/ecoma-io/core-services/commit/f60f09922e7c04ecfb71bfa039a86b3f3d1e56bf))
* **nestjs-typeorm:** add base entity classes for initial implementation of TypeORM ([d01e8b9](https://github.com/ecoma-io/core-services/commit/d01e8b93203111e71e0fc6c57d710bcffd1d9a6b))
* **nx-docker:** add Docker build and publish executors ([90e0179](https://github.com/ecoma-io/core-services/commit/90e0179ed46f39386af2f9da8ad829d6f66f76de))
* **nx-typeorm:** add TypeORM executors for database operations ([59c092b](https://github.com/ecoma-io/core-services/commit/59c092b21d1bb835a686001d38b203593994601d))
* **nx-typescript:** add Nx plugin for TypeScript projects ([660f8f6](https://github.com/ecoma-io/core-services/commit/660f8f691e48a78549009bf3c333cddc24d2308d))
* **parse-env-file:** add .env parser with escape sequence support ([83a64ed](https://github.com/ecoma-io/core-services/commit/83a64eda674d6922d190278b0bc6c979851777db))


### Bug Fixes

* **deps:** update dependency @typescript-eslint/utils ([#37](https://github.com/ecoma-io/core-services/issues/37)) ([77df1ff](https://github.com/ecoma-io/core-services/commit/77df1ffb7997cbbd2bf22b761e7c8908812e3ac8))
* **deps:** update dependency reflect-metadata ([#31](https://github.com/ecoma-io/core-services/issues/31)) ([9f2fd38](https://github.com/ecoma-io/core-services/commit/9f2fd385ce72cc0f1daf65f9d5199ad44504c06f))
* **deps:** update dependency uuid ([#22](https://github.com/ecoma-io/core-services/issues/22)) ([d4eb773](https://github.com/ecoma-io/core-services/commit/d4eb773d472d8c65385efd282e6746391fce3681))
* rename .github/renovation.json to .github/renovate.json ([0de093c](https://github.com/ecoma-io/core-services/commit/0de093c7dd9fb8caef4b60a3b6cf616e04b9810f))
