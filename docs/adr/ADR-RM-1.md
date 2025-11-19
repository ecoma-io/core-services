# ADR-RM-1 — Lựa chọn Công nghệ (Technology Stack)

## 1. Bối cảnh

Resource Management (RM) Service là bounded context chịu trách nhiệm quản lý vòng đời của tài nguyên số (digital assets) bao gồm upload, storage, metadata management, virus scanning và distribution. Dịch vụ cần đáp ứng các yêu cầu đặc thù:

- **High I/O throughput**: Xử lý hàng triệu file uploads và downloads
- **Low latency delivery**: Phân phối file với độ trễ thấp cho end users
- **Atomic quota management**: Quản lý quota storage chính xác trong môi trường concurrent cao
- **Security**: Virus scanning và access control cho private files
- **Cost optimization**: Giảm chi phí storage và network bandwidth
- **Multi-tenancy**: Hỗ trợ isolation dữ liệu theo tenant

Khác với IAM service sử dụng Event Sourcing hoàn toàn, RM có đặc điểm là **I/O intensive** với large binary data (files), do đó cần lựa chọn công nghệ phù hợp với pattern này.

## 2. Quyết định

Áp dụng stack công nghệ sau cho RM bounded context:

| Thành phần        | Công nghệ     | Vai trò                                                       |
| ----------------- | ------------- | ------------------------------------------------------------- |
| Framework         | NestJS        | Framework chính cho Command và Query services                 |
| Metadata Storage  | PostgreSQL    | Lưu trữ file metadata, ACL rules, quota tracking              |
| Object Storage    | S3/MinIO      | Lưu trữ binary files với high durability và scalability       |
| Quota Management  | Redis         | Atomic quota operations và hot ACL cache                      |
| Message Bus       | RabbitMQ      | Event distribution và delayed queue cho async cleanup         |
| Virus Scanning    | ClamAV        | Open-source antivirus engine cho background scanning          |
| CDN/Reverse Proxy | Traefik/Nginx | Intelligent routing: stream proxy vs redirect based on policy |

## 3. Hệ quả

### Tích cực

- **PostgreSQL** cung cấp ACID guarantees cho metadata, supporting complex queries cho file search và ACL management.
- **S3/MinIO** là industry standard cho object storage, hỗ trợ pre-signed URLs để offload upload/download traffic khỏi API servers.
- **Redis** cung cấp Lua scripting cho atomic quota operations, critical cho preventing quota overrun trong high-concurrency scenarios.
- **RabbitMQ** delayed message plugin hỗ trợ async cleanup workflow mà không cần external scheduler.
- **ClamAV** là mature open-source solution với regular signature updates và proven track record.
- **NestJS** consistency với IAM và các services khác, reducing learning curve.

### Tiêu cực

- **Không dùng Event Sourcing**: Trade-off audit trail hoàn chỉnh để tối ưu performance cho I/O workload. Mitigated bằng comprehensive logging.
- **S3 vendor lock-in risk**: Mitigated bằng MinIO compatibility (S3-compatible self-hosted option).
- **ClamAV performance**: Full file scanning có thể chậm cho large files. Mitigated bằng async processing và streaming scan.
- **Redis single point of failure**: Cần Redis Sentinel hoặc Cluster cho HA. Quota có thể rebuild từ PostgreSQL.
- **CDN cost**: Public files qua CDN tăng cost. Justified bởi improved user experience và reduced server load.

## 4. Các lựa chọn đã xem xét

- **Event Store DB cho metadata:**
  - _Lý do từ chối:_ Overkill cho RM use case. File metadata changes ít, không cần full event history cho mỗi file operation. PostgreSQL đơn giản hơn và đủ dùng.

- **MongoDB cho metadata:**
  - _Lý do từ chối:_ Không cần schema flexibility của NoSQL. File metadata có structure rõ ràng. PostgreSQL JSONB đủ cho flexible fields khi cần.

- **GridFS (MongoDB) cho file storage:**
  - _Lý do từ chối:_ Không scale tốt như S3. Thiếu native support cho pre-signed URLs. Tăng complexity khi cần CDN integration.

- **Local filesystem cho storage:**
  - _Lý do từ chối:_ Không scale horizontally. Khó backup/replication. Không có built-in redundancy như S3.

- **Memcached thay vì Redis:**
  - _Lý do từ chối:_ Thiếu Lua scripting cho atomic operations. Redis provides richer data structures (sorted sets, lists) useful cho quota tracking.

- **VirusTotal API thay vì ClamAV:**
  - _Lý do từ chối:_ External dependency, cost per scan, privacy concerns (files uploaded to third party). ClamAV on-premise có full control.

- **CloudFront/Cloudflare Workers cho delivery:**
  - _Lý do từ chối:_ Vendor lock-in, cost. Traefik/Nginx flexible hơn và có thể self-host. Có thể add CloudFront sau như optional layer.
