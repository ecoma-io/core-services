# ADR-G3 — Hạ tầng Nền tảng Chia sẻ cho Tất cả Dự án

## 1. Bối cảnh

Tổ chức chạy nhiều dịch vụ và bounded context trong một monorepo. Để giảm chi phí, tập trung vận hành và cung cấp tooling nhất quán, cần một nền tảng chia sẻ cung cấp các dịch vụ hạ tầng cốt lõi (database, event store, message broker, search, cache, observability). Chia sẻ hạ tầng giảm trùng lặp và overhead vận hành nhưng có rủi ro về contention tài nguyên và ảnh hưởng tenant.

Ràng buộc và yêu cầu:

- Giữ chi phí vận hành thấp và onboarding nhanh.
- Đảm bảo tách biệt dữ liệu theo service/bounded context để giới hạn blast radius.
- Cung cấp guardrails cho bảo mật, quota, backup/restore và monitoring.
- Platform team vận hành hạ tầng; các team dịch vụ vẫn sở hữu dữ liệu và logic ứng dụng của họ.

## 2. Quyết định

Áp dụng hạ tầng nền tảng chia sẻ cung cấp dịch vụ cốt lõi tập trung cho tất cả project đồng thời bắt buộc tách biệt dữ liệu theo service/bounded-context và áp dụng guardrails vận hành.

Các kiểm soát và pattern bắt buộc:

- **Tách biệt dữ liệu**
  - Mỗi service/BC phải có artifacts dữ liệu tách biệt rõ ràng (database riêng hoặc schema riêng, EventStore stream namespace, prefix index ES, RabbitMQ vhost) phù hợp yêu cầu.
- **Kubernetes tenancy**
  - Namespace per service/BC với ResourceQuota và LimitRange.
- **Messaging & Search**
  - RabbitMQ: vhost per bounded context và credentials per-vhost.
  - Elasticsearch: index-per-context và ILM policies.
- **Cache**
  - Redis: ưu tiên instance dedicated hoặc sidecar cho cache nhạy độ trễ; shared Redis cho cache ít quan trọng với QoS.
- **Bảo mật & Ops**
  - Secrets tập trung (Vault hoặc cloud KMS), network policies, RBAC, audit logging.
  - Định nghĩa RPO/RTO, runbooks backup/restore, SLO và alerting cho cluster và resource per-service.
  - Provision tự động qua IaC và CI; enforce qua admission controllers và linting trong CI khi phù hợp.

## 3. Lý do

- Giảm chi phí hạ tầng và vận hành bằng cách chia sẻ tài nguyên.
- Tập trung vận hành giúp giảm gánh nặng cho từng team dịch vụ.
- Tách biệt dữ liệu giúp giới hạn blast radius khi có sự cố.
- Guardrails bảo mật và vận hành giúp duy trì chất lượng dịch vụ.
- Trải nghiệm developer nhất quán và onboarding nhanh hơn với nền tảng chung.

## 4. Hệ quả

### Tích cực

- Giảm chi phí hạ tầng do chia sẻ tài nguyên.
- Vận hành tập trung giảm gánh nặng cho từng team.
- Trải nghiệm developer nhất quán và onboarding nhanh hơn.
- Kiểm soát bảo mật và compliance có thể áp dụng thống nhất.

### Tiêu cực

- Rủi ro contention tài nguyên và noisy-neighbour nếu không áp quota và monitoring.
- Platform team cần đầu tư vào automation, runbooks và observability.
- Một số dịch vụ có thể cần isolation cao hơn sau này, dẫn tới yêu cầu dedicated infra chọn lọc.

## 5. Các lựa chọn đã xem xét

- **Hạ tầng riêng cho từng team/service:**
  - _Lý do từ chối:_ Chi phí và overhead vận hành cao; onboarding chậm và vận hành phân mảnh.
- **Hoàn toàn dùng hạ tầng chung không tách biệt dữ liệu:**
  - _Lý do từ chối:_ Rủi ro rò rỉ dữ liệu, noisy neighbours và thiếu khả năng recovery per-service.
- **Hybrid (shared control plane, dedicated data plane khi cần):**
  - _Lý do chấp nhận có điều kiện:_ Thích hợp với các trường hợp yêu cầu bảo mật/hiệu năng cao; áp dụng chọn lọc và ghi lại qua ADR tiếp theo.
