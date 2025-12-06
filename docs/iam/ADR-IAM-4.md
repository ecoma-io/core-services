# ADR-IAM-4 — Cơ chế permissions registry và merge 2 major versions mới nhất

## 1. Bối cảnh

**Phân quyền Linh hoạt** là mục tiêu cốt lõi của hệ thống IAM. Hệ thống được phát triển với CI/CD và triển khai trên Kubernetes sử dụng rolling deployments và gradual rollouts để giảm downtime và rủi ro khi phát hành. Điều này dẫn tới một số yêu cầu và thách thức:

- **Phản ứng nhanh với thay đổi:** Dịch vụ liên tục thay đổi permission tree — cần cơ chế cho phép cập nhật mà không phá vỡ những phiên bản đang chạy.
- **Chạy nhiều phiên bản song song:** Khi rollout, phiên bản cũ và mới có thể chạy đồng thời; rollback phải an toàn.
- **Backward compatibility:** Các clients và dịch vụ khác cần thời gian nâng cấp; hệ thống phân quyền phải hỗ trợ phiên bản cũ trong một khoảng thời gian.

## 2. Quyết định

Triển khai một `permissions registry` nơi mỗi service đăng ký các permissions (dưới dạng cây) cần thiết cho business. IAM sẽ xây dựng cây permissions hợp nhất bằng "2-Major-Version Merge Strategy" với quy tắc priority-based deep merge.

Tóm tắt quyết định:

- Với mỗi service, chọn tối đa hai release đại diện cho hai `major` lớn nhất (mỗi major lấy release latest theo semver: highest minor, highest patch).
- Thực hiện `deep merge` giữa hai trees: khi xung đột node, node từ release có priority (semver) cao hơn sẽ override value/attributes của node thấp hơn; nhưng các children sẽ được merge đệ quy (không overwrite toàn bộ subtree trừ khi node explicit marked as replace).
- Ghi metadata audit cho từng node/leaf để biết nguồn (which release won) và timestamp.
- Kết quả merge được cache và chỉ rebuild khi có release mới hoặc khi registry metadata thay đổi.

## 3. Lý Do

Quyết định này dựa trên các yêu cầu thực tế của môi trường triển khai:

- **Hỗ trợ rolling deployments & rollback:** Khi deploy một major mới, một bản cũ vẫn có thể cần hoạt động song song. Việc giữ hai major đóng vai trò buffer cho rollback.
- **Giảm rủi ro breaking changes:** Nếu chỉ dùng latest version, release mới có thể phá vỡ clients đang dùng version cũ; merge hai major cho phép kế thừa các quyền cần thiết từ phiên bản cũ.
- **Minimize client complexity:** Clients không phải lựa chọn version khi truy vấn permission — IAM cung cấp một merged view có tính backward-compatible.
- **Deterministic & Auditable:** Quy tắc dựa trên semver nên kết quả merge là deterministic; lưu metadata giúp audit và debug.
- **Hiệu năng chấp nhận được:** Giữ giới hạn ở 2 majors giữ được độ phức tạp và overhead lưu trữ trong tầm kiểm soát; caching giảm tải tính toán runtime.

## 4. Hệ quả

### Tích cực

- **Deterministic:** Cùng input (set releases) → cùng output merge tree.
- **Auditable:** Với metadata cho từng node, có thể biết release nào thắng trong conflict.
- **Flexible:** Hỗ trợ rolling deployments, gradual rollouts và rollback an toàn.
- **Performance:** Kết quả merge có thể cache; rebuild chỉ khi nguồn thay đổi.
- **Backward compatible:** Quyền từ release cũ tiếp tục góp phần vào merged tree.

### Tiêu cực

- **Complexity:** Logic merge (priority, deep merge rules, replace markers) phức tạp và cần test kỹ.
- **Cache invalidation:** Khi có release mới, cần invalidate cache liên quan — điều này có thể khó tối ưu cho nhiều dịch vụ.
- **Storage overhead:** Lưu metadata và giữ ít nhất 2 versions cho mỗi service tăng nhu cầu lưu trữ.
- **Conflict resolution surprises:** Một số conflict có thể gây hành vi không mong muốn nếu developers không hiểu quy tắc priority.
- **Debugging:** Khi có lỗi về permissions, cần trace qua nhiều nguồn (two releases) để tìm nguyên nhân.

## 5. Các lựa chọn đã xem xét

- **Chỉ dùng latest version**
  - Lý do từ chối: Không hỗ trợ rolling deployment/rollback; gây downtime khi release mới có bug.

- **Merge tất cả versions không giới hạn**
  - Lý do từ chối: Complexity và chi phí tăng theo số versions; khó debug. Các service tuân thủ semver release thường không cần giữ nhiều hơn 2 major versions.

- **Client-specified version (không merge)**
  - Lý do từ chối: Client phải biết và chọn version; khiến client phức tạp và dễ gây breaking change.

- **Feature flags thay vì multi-version**
  - Lý do từ chối: Feature flags giải quyết khác problem; không giải quyết nhu cầu hỗ trợ hai version cho rollout/rollback.
