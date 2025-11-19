# ADR-G2 — Containerization và Kubernetes cho Production

## 1. Bối cảnh

Ứng dụng cần môi trường runtime nhất quán và có khả năng mở rộng trong production. Orchestration giúp đơn giản hóa việc deploy, scale và tự phục hồi các service.

## 2. Quyết định

Đóng gói dịch vụ bằng Docker và chạy workloads production trên Kubernetes (K8s).

## 3. Hệ quả

### Tích cực

- Hỗ trợ autoscaling và rescheduling tự động.
- Cung cấp mô hình deploy nhất quán cho các dịch vụ.
- Tích hợp với ingress controller, service mesh và chính sách cluster-level.

### Tiêu cực

- Tăng độ phức tạp vận hành cho quản lý cluster.
- Cần hệ thống observability, alerting và runbook chín muồi để vận hành an toàn.

## 4. Các lựa chọn đã xem xét

- **Chỉ Docker (không orchestration):** Đơn giản hơn cho deploy nhỏ nhưng thiếu autoscaling và self-healing.
  - _Lý do từ chối:_ Không phù hợp với yêu cầu scalability và resilience cho production.
- **Serverless (FaaS):** Giảm gánh nặng infra nhưng không phù hợp với dịch vụ stateful hoặc long-running và dễ dẫn đến vendor lock-in.
  - _Lý do từ chối:_ Trade-offs về compatibility và vận hành khiến serverless không phù hợp cho nhiều dịch vụ của chúng ta.
