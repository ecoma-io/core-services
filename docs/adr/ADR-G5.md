# ADR-G5 — EventStoreDB cho Event Sourcing

## 1. Bối cảnh

Một số bounded context trong hệ thống áp dụng Event Sourcing và cần một giải pháp lưu trữ tối ưu cho các sự kiện append-only, streams, snapshots và semantics của subscription.

## 2. Quyết định

Sử dụng EventStoreDB làm event store chính cho các dịch vụ triển khai Event Sourcing.

## 3. Hệ quả

### Tích cực

- Hỗ trợ native cho streams, projections, subscriptions và snapshotting.
- Mô hình append-only tối ưu cho workloads ghi nhiều trong ES.

### Tiêu cực

- Thêm một thành phần chuyên biệt để vận hành (backup, HA, monitoring).
- Cần adapters/serializers để tích hợp với domain models của ứng dụng.

## 4. Các lựa chọn đã xem xét

- **PostgreSQL làm event store:** Khả thi nhưng phải tự triển khai nhiều primitive (append hiệu quả, generate projection, quản lý snapshot).
  - _Lý do từ chối:_ Chi phí implement và maintain cao hơn so với hệ chuyên dụng.
- **Kafka hoặc log system khác:** Tốt cho streaming nhưng không cung cấp đầy đủ primitive cho Event Sourcing (streams semantics, projections, snapshotting) ngay từ đầu.
  - _Lý do từ chối:_ Thiếu các tính năng ES bậc nhất và sẽ cần công cụ bổ trợ.
