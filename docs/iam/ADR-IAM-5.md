# ADR-IAM-5 — Triển khai cơ chế hybrid Snapshot cho Aggregates (Hybrid Snapshot Policy)

## 1. Bối cảnh

Trong Event Sourcing, để rehydrate một Aggregate, hệ thống phải replay tất cả events từ đầu stream. Khi số lượng events tăng lên (ví dụ: một User có 10000+ events qua nhiều năm), performance của rehydration bị ảnh hưởng nghiêm trọng:

- **Latency:** Thời gian load aggregate tăng tuyến tính với số events
- **Database load:** Phải đọc nhiều events từ Event Store DB
- **Network overhead:** Transfer nhiều dữ liệu qua network
- **Memory pressure:** Phải giữ nhiều events trong memory để replay

**Snapshot** là giải pháp: Lưu trữ state của Aggregate tại một thời điểm cụ thể. Khi rehydrate, chỉ cần:

1. Load snapshot gần nhất
2. Replay các events sau snapshot

**Trade-offs cần cân nhắc:**

- **Quá thường xuyên:** Tốn storage và overhead cho việc tạo snapshot
- **Quá ít:** Không giải quyết được vấn đề performance
- **Storage:** Snapshot có thể rất lớn (ví dụ: Aggregate có nhiều nested entities)
- **Versioning:** Aggregate structure thay đổi theo thời gian, cần handle snapshot migration

## 2. Quyết định

Implement **Hybrid Snapshot Policy** dựa trên cả số lượng events và thời gian, với storage strategy phân tầng và versioning support.

Snapshot được tạo khi **bất kỳ** điều kiện nào sau đây thỏa mãn:

- **Event Count Threshold:** Sau mỗi n events được áp dụng cho aggregate kể từ snapshot cuối cùng.
- **Time Interval Threshold:** Sau mỗi t thời gian kể từ snapshot cuối cùng.

Ví dụ cấu hình cho User Aggregate:

- **Event Count Threshold:** 100 events
- **Time Interval Threshold:** 24 hours

-**Storage Strategy:** Sử dụng size threadhold để quyết định nơi lưu trữ snapshot:

- **Inline Storage:** Snapshots nhỏ threadhold được lưu trực tiếp trong Event Store DB.
- **Blob Storage:** Snapshots lớn threadhold được lưu trong blob storeage với reference trong Event Store DB.

## 3. Lý do

- **Performance:** Kết hợp cả hai điều kiện giúp đảm bảo có snapshot gần đây cho aggregates có tần suất thay đổi khác nhau.
- **Flexibility:** Cho phép tune thresholds dựa trên aggregate type và usage patterns.
- **Evolvability:** Hỗ trợ versioning cho snapshots:
  - Mỗi snapshot có metadata version
  - Khi load snapshot, nếu version cũ, áp dụng upcasting logic để migrate state
- **Storage Efficiency:** Phân tầng storage:
  - **Inline Storage:** Snapshots nhỏ (dưới threshold size) được lưu trực tiếp trong Event Store DB.
  - **Blob Storage:** Snapshots lớn được lưu trong blob storage với reference trong Event Store DB.

## 3. Hệ quả

### Tích cực

- **Performance improvement:** Giảm thời gian rehydration cho aggregates có nhiều events
- **Flexible policy:** Có thể tune per-aggregate type
- **Storage efficient:** Phân tầng inline/blob dựa trên size
- **Evolvability:** Versioning và upcasting hỗ trợ structural changes
- **Operational control:** Admin tools cho force snapshot và rebuild

### Tiêu cực

- **Complexity:** Thêm logic snapshot creation, storage, versioning và cleanup
- **Storage cost:** Phải lưu snapshots (mitigated bởi retention policy)
- **Consistency:** Snapshot có thể stale nếu không cleanup đúng
- **Testing:** Phải test snapshot creation, loading, upcasting và cleanup
- **Monitoring:** Cần monitor snapshot creation failures và storage usage

## 4. Các lựa chọn đã xem xét

- **Không dùng snapshot:**
  - _Lý do từ chối:_ Performance degradation nghiêm trọng cho long-lived aggregates. Không chấp nhận được cho production.

- **Snapshot sau mỗi N events (chỉ event count):**
  - _Lý do từ chối:_ Không đảm bảo có snapshot gần đây cho aggregates ít thay đổi. Khó cho audit và recovery.

- **Snapshot theo time interval chặt chẽ (ví dụ: mỗi giờ):**
  - _Lý do từ chối:_ Tốn overhead cho aggregates không thay đổi. Waste storage và compute.

- **Lazy snapshot (tạo khi load chậm):**
  - _Lý do từ chối:_ User request bị penalty khi trigger snapshot creation. Không predictable.

- **Lưu tất cả snapshots không retention:**
  - _Lý do từ chối:_ Storage cost tăng vô hạn. Không sustainable.
