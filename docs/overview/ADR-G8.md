# ADR-G8 — Áp dụng Behavior Driven Development (BDD)

## 1. Bối cảnh

Trong một tổ chức có nhiều bounded context và nhiều team (product teams, QA, PM, business stakeholders), việc đảm bảo rằng yêu cầu được hiểu thống nhất và kiểm thử chéo giữa các bên là thách thức lớn. Các test unit/tích hợp truyền thống không luôn phản ánh đúng kì vọng nghiệp vụ của stakeholder, dẫn tới gap giữa yêu cầu và sản phẩm.

## 2. Quyết định

Áp dụng Behavior Driven Development (BDD) như một phương pháp phát triển chính cho các tính năng quan trọng xuyên domain. Cụ thể:

- Viết các đặc tả hành vi ở dạng Gherkin (`.feature`) bởi PO/BA/QA cùng developer khi grooming.
- Dùng Cucumber (hoặc tương đương) để tự động hóa các feature tests.
- Lưu trữ feature files trong repository gần code ứng dụng (ví dụ `apps/<app>/features` hoặc `e2e/features`) và giữ step definitions trong một package chung khi cần tái sử dụng (`packages/bdd` hoặc `libs/core-project-integration-environment`).
- Chạy feature tests trong CI (tách rõ các job e2e/bdd) và map các feature tag vào pipeline (ví dụ `@smoke`, `@regression`).

## 3. Lý do

- Cải thiện giao tiếp giữa business và engineering thông qua ngôn ngữ chung (Gherkin).
- Đảm bảo yêu cầu được định nghĩa rõ ràng trước khi code, giảm thiểu rủi ro hiểu sai.
- Tạo tài liệu sống (living documentation) dễ đọc và duy trì.
- Hỗ trợ tự động hóa kiểm thử end-to-end, giúp phát hiện sai sót sớm hơn trong chu trình phát triển.
- Tăng tính minh bạch và khả năng theo dõi tiến độ thông qua các scenarios đã được định nghĩa.

## 4. Hệ quả

### Tích cực

- Cải thiện giao tiếp giữa business và engineering: feature files trở thành "living documentation" dễ đọc cho cả non-dev stakeholders.
- Giảm số lỗi về yêu cầu (misinterpretation) nhờ acceptance criteria được định nghĩa rõ ràng trước khi code.
- Hỗ trợ test automation end-to-end có khả năng kiểm chứng yêu cầu thực tế.

### Tiêu cực / Chi phí

- Yêu cầu đào tạo team (Gherkin, viết scenarios tốt, quản lý step definitions).
- Chi phí bảo trì các BDD tests có thể tăng nếu step definitions không được tổ chức tốt.
- Feature tests có thể chạy chậm và cần đầu tư vào test infra (testcontainers, parallelization) để không làm chậm pipeline.

## 5. Các lựa chọn đã xem xét

- **Không dùng BDD, chỉ unit/integration tests:** Dễ thực hiện nhưng vẫn có gap giữa business expectation và implementation.
  - _Lý do từ chối:_ Không giải quyết đủ vấn đề giao tiếp cross-team và không tạo ra documentation dễ đọc cho stakeholders.
- **Specification by Example (docs only, không tự động hóa):** Viết examples nhưng không chạy như tests.
  - _Lý do từ chối:_ Mất lợi ích tự động hóa, dễ bị lỗi out-of-date.
- **TDD (Test-Driven Development) strict:** Hướng dev-centric, tốt cho quality nhưng không tập trung vào ngôn ngữ chung với business.
  - _Lý do từ chối:_ Thiếu phương tiện để PO/BA tham gia trực tiếp vào viết/đọc acceptance criteria.
