# ADR-G9 — Lựa chọn NestJS với TypeScript cho Backend

## 1. Bối cảnh

Hệ thống cần một framework backend tiêu chuẩn cho nhiều dịch vụ microservice trong monorepo, hỗ trợ module hóa, dependency injection, testability, và dễ tích hợp với các thư viện như OpenTelemetry, validation, và các adapter (EventStore, RabbitMQ, Postgres, v.v.). Việc lựa chọn framework sẽ ảnh hưởng tới DX, tốc độ phát triển và vận hành.

## 2. Quyết định

Sử dụng **NestJS** kết hợp **TypeScript** làm framework backend chuẩn cho toàn bộ repository. NestJS sẽ là chuẩn tham chiếu cho cách tổ chức module, controller, provider, interceptor và exception handling.

## 3. Lý do

- **Module hóa rõ ràng:** NestJS cung cấp cấu trúc module rõ ràng, giúp tách biệt các bounded contexts và dễ dàng tái sử dụng code giữa các dịch vụ.
- **Dependency Injection mạnh mẽ:** Hệ thống DI tích hợp giúp quản lý dependencies hiệu quả, dễ dàng mock trong unit tests và integration tests phù hợp với kiến trúc DDD và CA.
- **TypeScript end-to-end:** NestJS được viết hoàn toàn bằng TypeScript, giúp tận dụng lợi thế của type safety, giảm lỗi thời gian chạy.
- **Hệ sinh thái phong phú:** NestJS có nhiều module tích hợp sẵn (OpenTelemetry, Swagger, class-validator, Passport, CQRS modules, v.v.) giúp tăng tốc phát triển.
- **Cộng đồng và tài liệu:** NestJS có cộng đồng lớn và tài liệu phong phú, giúp dev mới dễ dàng onboarding và tìm kiếm giải pháp cho các vấn đề phát sinh.
- **Adapter linh hoạt:** Hỗ trợ nhiều adapter (Express, Fastify), giúp tối ưu hiệu năng khi cần thiết.

## 4. Hệ quả

### Tích cực

- Kiến trúc module hóa rõ ràng, dễ tách và reuse giữa các bounded contexts.
- Hệ thống DI (Dependency Injection) mạnh mẽ giúp tách concerns, dễ mock trong unit/integration tests.
- Hỗ trợ TypeScript end-to-end (typesafe), giúp giảm lỗi thời gian chạy.
- Hệ sinh thái phong phú (integration với OpenTelemetry, Swagger, class-validator, Passport, CQRS modules, v.v.).
- Có cộng đồng và nhiều ví dụ, giúp onboarding nhanh hơn.

### Tiêu cực / Chi phí

- Độ trừu tượng của NestJS có thể gây learning curve cho dev mới chưa quen với DI/container patterns.
- Một số trường hợp hiệu năng tối ưu (micro-benchmarks) cần tune (ví dụ: chuyển sang Fastify adapter khi cần throughput cao).

## 5. Các lựa chọn đã xem xét

- **Express + TypeScript (hand-rolled):** Đơn giản nhưng thiếu cấu trúc module/DI tích hợp sẵn.
  - _Lý do từ chối:_ Mất nhiều boilerplate để đạt được cùng cấp độ tổ chức, khó thống nhất pattern toàn repo.
- **Fastify + plugin-based architecture (không Nest):** Hiệu năng tốt nhưng thiếu DI/structure mặc định.
  - _Lý do từ chối:_ Có thể được dùng làm adapter (Fastify adapter trong NestJS) nhưng không làm chuẩn toàn repo.
- **Quarkus/Micronaut (JVM):** Ngôn ngữ khác, gây overhead cho team TypeScript-focused.
  - _Lý do từ chối:_ Không phù hợp với số lượng dev TypeScript và mono-repo toolchain hiện tại.
