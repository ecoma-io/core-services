# ADR-G4 — Xác thực Service-to-Service: S2S Tokens (Client Credentials)

## 1. Bối cảnh

Các dịch vụ nền tảng cần cơ chế xác thực service-to-service an toàn và có thể tự động hoá cho API nội bộ giữa các cluster và namespace.

## 2. Quyết định

Sử dụng token S2S theo OAuth2 client credentials flow cho xác thực nội bộ thay vì mutual TLS (mTLS).

## 3. Lý do

- S2S tokens đơn giản hơn để quản lý và tự động hoá so với mTLS, đặc biệt trong môi trường đa dịch vụ và đa cluster.
- Dễ tích hợp với các hệ thống identity và token issuers hiện có.
- Cung cấp khả năng kiểm soát truy cập chi tiết thông qua scope và claims trong token.
- Giảm độ phức tạp vận hành liên quan đến quản lý certificate và rotation của mTLS.

## 4. Hệ quả

### Tích cực

- Giảm độ phức tạp vận hành so với quản lý certificate và rotation của mTLS.
- Dễ tích hợp với token issuers và identity providers hiện có.
- Đơn giản hóa tự động hóa CI/CD cho danh tính dịch vụ.

### Tiêu cực

- Cần hệ thống phát hành token và quản lý vòng đời (rotation, revocation, auditing) đủ mạnh.
- Phải đảm bảo bảo mật lớp vận chuyển (TLS) và thiết kế scope/least-privilege hợp lý cho token.

## 5. Các lựa chọn đã xem xét

- **mTLS:** Cung cấp mutual authentication mạnh.
  - _Lý do từ chối:_ Tăng độ phức tạp quản lý certificate, rotation và phân phối.
- **API keys:** Triển khai đơn giản nhưng ít an toàn do thiếu expiry và rotation.
  - _Lý do từ chối:_ Không đáp ứng các yêu cầu bảo mật mong muốn cho xác thực nội bộ.
