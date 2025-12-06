# Identity Management (IDM) Domain Model

Tài liệu này mô tả chi tiết thiết kế miền cho Bounded Context **Identity Management (IDM)**, chịu trách nhiệm quản lý vòng đời định danh người dùng, xác thực thông tin cá nhân và quản lý credentials.

## 1. Aggregate Roots

### User Aggregate Root

Đại diện cho một người dùng trong hệ thống. User là global entity nó độc lập với các tenants

| Field              | Type                              | Description                                                    |
| ------------------ | --------------------------------- | -------------------------------------------------------------- |
| `userId`           | [`UserId`](#UserId)               | UUID v7 — Aggregate root identifier (readonly)                 |
| `email`            | [`Email`](#Email)                 | Địa chỉ email đã được validate — unique trên toàn hệ thống     |
| `username?`        | [`Username`](#Username)           | Tên đăng nhập tùy chọn — unique nếu được sử dụng               |
| `passwordHash`     | [`PasswordHash`](#PasswordHash)   | Hash mật khẩu (Argon2id)                                       |
| `profile`          | [`UserProfile`](#UserProfile)     | Thông tin hồ sơ người dùng (họ tên, avatar, phone, metadata)   |
| `accountStatus`    | [`AccountStatus`](#AccountStatus) | Enum trạng thái tài khoản (Active, Suspended, Locked, Deleted) |
| `emailVerified`    | `boolean`                         | Flag cho biết email đã được xác thực hay chưa                  |
| `emailVerifiedAt?` | `DateTime`                        | Thời điểm email được xác thực                                  |
| `mfaEnabled`       | `boolean`                         | MFA đã bật hay chưa                                            |
| `mfaMethod?`       | `MFAMethod`                       | Phương thức MFA ưu tiên (TOTP, SMS)                            |
| `mfaSecret?`       | `string`                          | Bí mật MFA (chỉ tồn tại khi `mfaEnabled = true`)               |
| `createdAt`        | `DateTime`                        | Thời điểm tạo tài khoản                                        |
| `updatedAt`        | `DateTime`                        | Thời điểm cập nhật gần nhất                                    |
| `deletedAt?`       | `DateTime`                        | Thời điểm soft-delete (nếu đã xóa)                             |

- **Invariants (Quy tắc Bất biến):**
  - Email, username (nếu có) phải là duy nhất trên toàn hệ thống. Việc enforce unique constraint này phải được thực hiện bằng Guard Streams kết hợp Atomic Write/Transaction của EventStoreDB như quy định tại [ADR-IAM-7](/iam/ADR-IAM-7.md).
  - Ghi chú: Chi tiết cơ chế enforcement cho ràng buộc duy nhất (Guard Streams và Atomic Key Swap) được mô tả trong [ADR-IAM-7](/iam/ADR-IAM-7.md) — tài liệu này là nguồn tham chiếu kỹ thuật cho key-release và reservation workflows.
  - Mật khẩu phải được lưu dưới dạng hash an toàn (sử dụng Argon2id) — [xem ADR-IAM-8](iam/ADR-IAM-8.md).
  - User không thể thay đổi email mà không khởi động luồng xác thực (verification) — luồng này phát verification token và đặt `emailVerified=false` cho đến khi xác nhận.
  - MFA secrets (ví dụ: TOTP secret) chỉ được set hoặc kích hoạt khi MFA đã được bật cho User.
  - Raw secrets nhạy cảm (ví dụ: raw password, raw refresh/access tokens) không được lưu unencrypted trong event payloads hoặc Read Models. Token payload (claims) có thể được lưu có điều kiện — chỉ whitelist các claims cần thiết (ví dụ `sid`, `sub`, `exp`, `iat`, `client_id`, `scope`) và phải áp dụng masking hoặc mã hóa cho các trường chứa PII.
  - **RÀNG BUỘC KEY RELEASE:** Quy tắc giải phóng khóa được phân biệt giữa `Email` và `Username`:
    - **Email:** Email chỉ được giải phóng (release) khi tài khoản chuyển sang **Deleted** (`UserAccountDeletedEvent`) hoặc khi xảy ra **Expired** do cơ chế **Atomic Takeover** (`UserAccountExpiredEvent`). Các trạng thái **Active**, **Suspended**, hoặc **Locked** **không** giải phóng email; khóa email có thể tồn tại ở trạng thái PendingVerification cho đến khi hết hạn hoặc được xác thực.
    - **Username:** Hệ thống hỗ trợ đổi `username` nguyên tử thông qua cơ chế Guard Streams và Multi-Stream Atomic Write (xem [ADR-IAM-7](/iam/ADR-IAM-7.md)). Khi bật, Command Handler phải thực hiện một ghi nguyên tử (atomic write) bao gồm cập nhật stream aggregate `iam-user-<userId>` và các sự kiện khóa liên quan (`UsernameLockReleasedEvent` / `UsernameLockAcquiredEvent`) vào các Guard Streams để tránh race condition hoặc duplicate. Nếu một Product/Org quyết định không cho phép đổi username, chính sách đó phải được áp dụng ở tầng business/validator.
    - Thao tác xóa (`UserAccountDeletedEvent`) **phải** được thực hiện thông qua **Multi-Stream Atomic Write** ghi đồng thời: (1) `UserAccountDeletedEvent` vào Aggregate Stream, (2) `EmailLockReleasedEvent` vào Guard Stream Email (ví dụ `unique-email-<hash(normalizedEmail)>`), và (3) `UsernameLockReleasedEvent` vào Guard Stream Username (ví dụ `unique-username-<hash(username)>`) (nếu có), đảm bảo giải phóng khóa nguyên tử.

- **Value Objects:** [`UserId`](#UserId), [`Email`](#Email), [`Username`](#Username), [`PasswordHash`](#PasswordHash), [`UserProfile`](#UserProfile), [`AccountStatus`](#AccountStatus)
- **Events:** [`UserRegisteredEvent`](#UserRegisteredEvent), [`UserEmailVerifiedEvent`](#UserEmailVerifiedEvent), [`UserProfileUpdatedEvent`](#UserProfileUpdatedEvent), [`UserPasswordChangedEvent`](#UserPasswordChangedEvent), [`EmailChangeInitiatedEvent`](#EmailChangeInitiatedEvent), [`EmailChangedEvent`](#EmailChangedEvent), [`UserAccountSuspendedEvent`](#UserAccountSuspendedEvent), [`UserAccountActivatedEvent`](#UserAccountActivatedEvent), [`UserAccountLockedEvent`](#UserAccountLockedEvent), [`UserAccountUnlockedEvent`](#UserAccountUnlockedEvent), [`UserAccountDeletedEvent`](#UserAccountDeletedEvent), [`UserAccountExpiredEvent`](#UserAccountExpiredEvent), [`MFAEnabledEvent`](#MFAEnabledEvent), [`MFADisabledEvent`](#MFADisabledEvent)
- **Ports:** `IUserRepository`, `IPasswordHasher`, `IVerificationTokenStore`, `IEmailSender`, `IEventStore`, `ISnapshotStore`

## 2. Value Objects

### UserId

Định danh duy nhất cho mỗi người dùng trong hệ thống.

- **Type:** string
- **Business Invariants:**
  - Phải là UUIDv7.
  - Không được phép thay đổi sau khi tạo.

### Email

Địa chỉ email đã được chuẩn hóa và xác thực, dùng để định danh và liên lạc với người dùng.

- **Type:** string
- **Business Invariants:**
  - Phải tuân theo định dạng email chuẩn (Không chỉ tuân thủ RFC 5322, mà còn yêu cầu một Fully Qualified Domain Name).
  - Luôn được chuẩn hóa (lowercase) khi khởi tạo.
  - Phải là duy nhất trên toàn hệ thống (xem thêm [ADR-IAM-7](/iam/ADR-IAM-7.md) để biết thêm chi tiết về đảm bảo rằng buộc unique).

### PasswordHash

Giá trị băm mật khẩu của người dùng, đảm bảo an toàn và không thể khôi phục về mật khẩu gốc.

- **Type:** string
- **Business Invariants:**
  - Phải được tạo bằng thuật toán băm mật khẩu an toàn.

### UserProfile

Thông tin hồ sơ cá nhân của người dùng, bao gồm tên và avatar.

- **Type:** object
- **Fields:** `firstName`, `lastName`, `avatarUrl?`
- **Business Invariants:**
  - `firstName` và `lastName` không được để trống.

### AccountStatus

Trạng thái hiện tại của tài khoản người dùng trong hệ thống.

- **Type:** enum
- **Values:** `Active`, `Suspended`, `Locked`, `Deleted`

### Username

Tên đăng nhập tùy chọn, dùng để định danh người dùng ngoài email.

- **Type:** string
- **Business Invariants:**
  - Phải tuân theo quy tắc định dạng (non-empty, [a-z0-9_.-], không bắt đầu/kết thúc bằng separator, không có separator liên tiếp, dài không quá 24 ký tự).
  - Nếu được sử dụng, phải là duy nhất trong hệ thống (xem thêm [ADR-IAM-7](/iam/ADR-IAM-7.md) để biết thêm chi tiết về đảm bảo rằng buộc unique).

## 3. Events

### 3.1 User Events

User-related events emitted by the `User` aggregate.

#### UserRegisteredEvent

Được phát khi một tài khoản `User` mới được tạo thành công

| Field           | Type           | Description                                                                                                                                                                                                                                                                                                 |
| --------------- | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `userId`        | `UserId`       | Định danh của `User` được tạo                                                                                                                                                                                                                                                                               |
| `email`         | `Email`        | Email của user (đã được chuẩn hóa)                                                                                                                                                                                                                                                                          |
| `username?`     | `Username`     | Username tùy chọn                                                                                                                                                                                                                                                                                           |
| `passwordHash?` | `PasswordHash` | Hash mật khẩu (Argon2id) _nếu có_ — Khi user đăng ký bằng mật khẩu, event này **có thể** chứa `passwordHash` đã được băm bằng `Argon2id` theo ADR-IAM-8. Nếu user đăng ký bằng external provider (social) thì trường này có thể bỏ qua. **LƯU Ý BẢO MẬT:** raw password không bao giờ được lưu trong event. |
| `profile`       | `UserProfile`  | Dữ liệu hồ sơ ban đầu                                                                                                                                                                                                                                                                                       |
| `createdAt`     | `DateTime`     | Thời điểm đăng ký                                                                                                                                                                                                                                                                                           |
| `createdBy?`    | `UserId`       | Actor đã thực hiện thao tác (tùy chọn)                                                                                                                                                                                                                                                                      |

#### UserEmailVerifiedEvent

Được phát khi địa chỉ email của `User` được xác thực

| Field                 | Type       | Description                |
| --------------------- | ---------- | -------------------------- |
| `userId`              | `UserId`   | Định danh `User`           |
| `email`               | `Email`    | Email đã được xác thực     |
| `verifiedAt`          | `DateTime` | Thời điểm xác thực         |
| `verificationMethod?` | `string`   | Phương thức/nguồn xác thực |

#### UserProfileUpdatedEvent

Được phát khi hồ sơ của `User` được cập nhật

| Field        | Type       | Description                                     |
| ------------ | ---------- | ----------------------------------------------- |
| `userId`     | `UserId`   | Định danh `User`                                |
| `changes`    | `object`   | Một phần `UserProfile` chứa các trường thay đổi |
| `updatedAt`  | `DateTime` | Thời điểm cập nhật                              |
| `updatedBy?` | `UserId`   | Actor đã thực hiện cập nhật                     |

#### UserPasswordChangedEvent

Được phát khi mật khẩu của `User` được thay đổi

| Field          | Type           | Description                           |
| -------------- | -------------- | ------------------------------------- |
| `userId`       | `UserId`       | Định danh `User`                      |
| `passwordHash` | `PasswordHash` | Hash mật khẩu mới (chỉ hash)          |
| `changedAt`    | `DateTime`     | Thời điểm thay đổi                    |
| `changedBy?`   | `UserId`       | Actor đã thay đổi mật khẩu (tùy chọn) |

#### EmailChangeInitiatedEvent

Được phát khi `User` khởi tạo yêu cầu đổi email (bắt đầu luồng Pending Verification). Sự kiện này thường được ghi vào Aggregate Stream khi bắt đầu quy trình đổi email và thường đi kèm với hành vi ghi các sự kiện khóa trên Guard Streams (ví dụ `EmailLockReleasedEvent` / `EmailLockAcquiredEvent`) trong cùng một Multi-Stream Atomic Write.

| Field          | Type       | Description                                          |
| -------------- | ---------- | ---------------------------------------------------- |
| `userId`       | `UserId`   | Định danh `User`                                     |
| `oldEmail?`    | `Email`    | Email cũ (nếu có)                                    |
| `newEmail`     | `Email`    | Email mới (chưa được xác thực)                       |
| `expiresAt?`   | `DateTime` | (Tùy chọn) thời hạn verification/pending reservation |
| `requestedAt`  | `DateTime` | Thời điểm khởi tạo yêu cầu đổi email                 |
| `requestedBy?` | `UserId`   | Actor khởi tạo (tùy chọn)                            |

#### EmailChangedEvent

Được phát khi `User` hoàn tất xác thực Email mới (confirm) và aggregate cập nhật email chính thức. Sự kiện này được ghi vào Aggregate Stream sau khi Guard Streams đã đảm bảo khóa nguyên tử cho email mới.

| Field        | Type       | Description                  |
| ------------ | ---------- | ---------------------------- |
| `userId`     | `UserId`   | Định danh `User`             |
| `oldEmail?`  | `Email`    | Email trước đó (nếu có)      |
| `newEmail`   | `Email`    | Email mới đã được xác thực   |
| `changedAt`  | `DateTime` | Thời điểm xác nhận/ghi event |
| `changedBy?` | `UserId`   | Actor xác nhận (tùy chọn)    |

#### UserAccountSuspendedEvent

Được phát khi tài khoản `User` bị suspend

| Field          | Type       | Description                 |
| -------------- | ---------- | --------------------------- |
| `userId`       | `UserId`   | Định danh `User`            |
| `reason?`      | `string`   | Lý do bị suspend (tùy chọn) |
| `suspendedAt`  | `DateTime` | Thời điểm bị suspend        |
| `suspendedBy?` | `UserId`   | Actor đã suspend tài khoản  |

#### UserAccountActivatedEvent

Được phát khi tài khoản `User` bị suspend được kích hoạt lại

| Field          | Type       | Description                   |
| -------------- | ---------- | ----------------------------- |
| `userId`       | `UserId`   | Định danh `User`              |
| `activatedAt`  | `DateTime` | Thời điểm kích hoạt           |
| `activatedBy?` | `UserId`   | Actor đã kích hoạt (tùy chọn) |

#### UserAccountLockedEvent

Được phát khi tài khoản `User` bị khóa (ví dụ: quá nhiều lần đăng nhập thất bại)

| Field       | Type       | Description                 |
| ----------- | ---------- | --------------------------- |
| `userId`    | `UserId`   | Định danh `User`            |
| `lockedAt`  | `DateTime` | Thời điểm bị khóa           |
| `reason?`   | `string`   | Lý do khóa (tùy chọn)       |
| `lockedBy?` | `UserId`   | Actor đã thực hiện thao tác |

#### UserAccountUnlockedEvent

Được phát khi tài khoản `User` được mở khóa

| Field         | Type       | Description                   |
| ------------- | ---------- | ----------------------------- |
| `userId`      | `UserId`   | Định danh `User`              |
| `unlockedAt`  | `DateTime` | Thời điểm mở khóa             |
| `reason?`     | `string`   | Lý do khóa/mở khóa (tùy chọn) |
| `unlockedBy?` | `UserId`   | Actor đã thực hiện thao tác   |

#### UserAccountDeletedEvent

Được phát khi tài khoản `User` bị soft-delete

| Field        | Type       | Description                       |
| ------------ | ---------- | --------------------------------- |
| `userId`     | `UserId`   | Định danh `User`                  |
| `deletedAt`  | `DateTime` | Thời điểm xóa (soft-delete)       |
| `deletedBy?` | `UserId`   | Actor đã thực hiện xóa (tùy chọn) |

#### MFAEnabledEvent

Được phát khi `User` bật MFA

| Field              | Type        | Description                               |
| ------------------ | ----------- | ----------------------------------------- |
| `userId`           | `UserId`    | Định danh `User`                          |
| `method?`          | `MFAMethod` | Phương thức MFA được bật (TOTP, SMS, ...) |
| `encryptedSecret?` | `string`    | Bí mật MFA đã được mã                     |
| `enabledAt`        | `DateTime`  | Thời điểm bật                             |
| `enabledBy?`       | `UserId`    | Actor đã bật MFA                          |

#### MFADisabledEvent

Được phát khi `User` tắt MFA

| Field         | Type        | Description            |
| ------------- | ----------- | ---------------------- |
| `userId`      | `UserId`    | Định danh `User`       |
| `method?`     | `MFAMethod` | Phương thức MFA bị tắt |
| `disabledAt`  | `DateTime`  | Thời điểm tắt          |
| `disabledBy?` | `UserId`    | Actor đã tắt MFA       |

#### UserAccountExpiredEvent

Được phát khi tài khoản `User` bị vô hiệu hóa/soft-delete do **Atomic Takeover** (khóa email/username hết hạn bị giành lại).

| Field              | Type       | Description                             |
| :----------------- | :--------- | :-------------------------------------- |
| `userId`           | `UserId`   | Định danh `User` bị hết hạn (Account A) |
| `expiredAt`        | `DateTime` | Thời điểm hết hạn                       |
| `takeoverByUserId` | `UserId`   | ID của User mới giành khóa (Account B)  |
| `expiredKey`       | `string`   | Khóa bị giành (email hoặc username)     |

### 3.2 Event Store Stream Mapping

Để đảm bảo nhất quán khi ghi events vào EventStoreDB, các event liên quan đến `User` phải được append vào stream có tên theo quy ước chung (tham chiếu: `docs/overview/overview-architecture.md`, ADR-G5). Quy ước stream pattern cho Aggregate `User` như sau:

- Aggregate: `User` → EventStore stream pattern: `iam-user-<userId>` (ví dụ: `iam-user-00000000-0000-0000-0000-000000000001`).
- Category: `iam-user` (sử dụng khi cần persistent subscription theo category).

Lưu ý: Đây là **canonical stream pattern** cho aggregate `User` trong toàn bộ BC IAM; mọi ADR, ví dụ và tooling phải sử dụng `iam-user-<userId>` làm tên stream aggregate chuẩn để đảm bảo interoperability.

Áp dụng cho các Domain Events trong tài liệu này (không giới hạn):

- `UserRegisteredEvent` → append to `iam-user-<userId>`
- `UserPasswordChangedEvent` → append to `iam-user-<userId>`
- `UserEmailVerifiedEvent` → append to `iam-user-<userId>`
- `UserProfileUpdatedEvent` → append to `iam-user-<userId>`
- `UserAccountSuspendedEvent`, `UserAccountActivatedEvent`, `UserAccountLockedEvent`, `UserAccountUnlockedEvent`, `UserAccountDeletedEvent` → append to `iam-user-<userId>`
- `MFAEnabledEvent`, `MFADisabledEvent` → append to `iam-user-<userId>`

- **THỰC THI KEY RELEASE ATOMIC:** Thao tác xóa tài khoản (Delete) hoặc vô hiệu hóa do hết hạn (Expire) là một **Atomic Transaction** đặc biệt.
  - Command Handler xử lý `UserAccountDeletedEvent` **phải** sử dụng `IEventStore.appendAtomic` để ghi đồng thời sự kiện này vào `iam-user-<userId>` VÀ các sự kiện giải phóng khóa (`EmailLockReleasedEvent`, `UsernameLockReleasedEvent`) vào các Guard Streams tương ứng (ví dụ `unique-email-<hash(normalizedEmail)>`, `unique-username-<hash(username)>`) để tuân thủ ràng buộc Key Release.
  - `UserAccountExpiredEvent` là một phần của giao dịch **Atomic Takeover** (tham khảo 6.1.3 ADR-IAM-7) và được thực thi nguyên tử (atomic) cùng với việc giành khóa mới bởi User khác.

Ghi chú:

- Luôn tuân theo quy ước tên stream trong `overview-architecture.md` / ADR-G5 để đảm bảo interoperability với `forwarder`, `projector` và các worker khác.
- Các projectors hoặc consumers có thể tạo các category streams hoặc projections tuỳ theo nhu cầu, nhưng nguồn chân lý cho mỗi aggregate phải là stream `iam-user-<userId>`.
- Khi cần indexing hoặc tìm kiếm theo email/username (global), sử dụng Read Models/Projectors (Postgres/Elasticsearch) chứ không ghi thêm event vào stream khác trái quy ước.

## 4. Domain Services

### 4.1 ReservationService

**[ACTION]** Service này đã bị loại bỏ vì cơ chế khóa đã chuyển sang Guard Streams + Atomic Write tại tầng Command Handler (xem ADR-IAM-7).

- **Business Invariants:** N/A
- **Aggregate Root**: N/A
- **Ports:** N/A

### 4.2 PasswordService

Quản lý hashing, verify và policy liên quan đến mật khẩu (Argon2id trong production).

- `hash(password: string): Promise<string>`: Tạo hash mật khẩu (Argon2id theo config).
- `verify(password: string, hash: string): Promise<boolean>`: Kiểm tra mật khẩu so với hash.
- `needsRehash(hash: string): Promise<boolean>`: Kiểm tra xem hash cần rotate theo policy mới hay không.
  - **Business Invariants:**
  - Mật khẩu lưu chỉ ở dạng hash; raw secret không được lưu unencrypted trong events/projections.
  - Sử dụng Argon2id cấu hình theo môi trường (time/memory/parallelism).
    **Aggregate Root**: User Aggregate Root
    **Ports:** `IPasswordHasher`, `IEventStore`

### 4.3 VerificationService

Quản lý việc phát hành và xác thực các verification token (email verify, password reset).

**Lưu ý:** Logic Atomic Key Swap cho email hiện được xử lý trong Command Handler, không phải Service này.

- `issueVerificationToken(userId: string, type: 'email' | 'password_reset', expiresIn?: number): Promise<string>`: Tạo và lưu token xác thực liên quan đến user.
- `verifyToken(userId: string, token: string, type?: string): Promise<boolean>`: Xác minh token; trả về `true` nếu hợp lệ.
- `revokeToken(userId: string, token: string): Promise<void>`: Thu hồi token.

- **Business Invariants:**
  - Token phải có TTL và một lần kích hoạt (one-time use) đối với các luồng nhạy cảm.
  - Token không bao giờ chứa raw password hoặc secret unencrypted trong event payload;
    **Aggregate Root**: User Aggregate Root
    **Ports:** `IVerificationTokenStore`, `IEmailSender`, `ITemplateRenderer`

### 4.4 EmailService

Service tường minh để gửi email hệ thống (verification, password reset, notifications).

- `sendVerificationEmail(userId: string, email: string, token: string): Promise<void>`: Gửi mail xác thực.
- `sendPasswordResetEmail(userId: string, email: string, token: string): Promise<void>`: Gửi mail reset mật khẩu.
- `sendTemplate(email: string, templateId: string, data: object): Promise<void>`: Gửi mail theo template.

- **Business Invariants:**
  - Email gửi phải tuân thủ rate-limit và retry policy (để tránh spam và overload).
    **Aggregate Root**: N/A (infra-facing domain service invoked from commands)
    **Ports:** `IEmailSender`, `ITemplateRenderer`, `IRateLimiter`

### 4.5 MFAService

Quản lý lifecycle MFA (TOTP) và tương tác với WebAuthn flows.

- `enableTOTP(userId: string): Promise<{secret: string, qr: string}>`: Bắt đầu đăng ký TOTP và trả raw `secret` cho client (chưa enable hoàn toàn). **Lưu ý:** raw secret trả về cho client không được persist unencrypted.
- `confirmTOTP(userId: string, code: string): Promise<boolean>`: Xác nhận mã TOTP và bật MFA. Khi bật thành công, hệ thống **phải** persist MFA secret thông qua `MFAEnabledEvent` chứa `encryptedSecret`
- `disableMFA(userId: string): Promise<void>`: Tắt MFA cho user.
- `verifyMFAForSession(sessionId: string, credential: any): Promise<boolean>`: Xác thực MFA trên session.

- **Business Invariants:**
  - MFA secret chỉ được persist khi người dùng hoàn tất flow đăng ký và MFA flagged là enabled.
    **Aggregate Root**: User Aggregate Root, Session Aggregate Root
    **Ports:** `IMFAProvider`, `IMFASecretStore`, `IWebAuthnRepository`

### 4.6 WebAuthnService

Quản lý đăng ký và xác thực credential WebAuthn (FIDO2).

- `registerCredentialStart(userId: string): Promise<object>`: Tạo challenge và options cho client.
- `registerCredentialFinish(userId: string, attestation: any): Promise<{credentialId: string}>`: Xác nhận attestation và lưu credential.
- `verifyAssertion(userId: string, assertion: any): Promise<boolean>`: Xác thực assertion cho login.

- **Business Invariants:**
  - Public key credential chỉ lưu metadata và publicKey; raw attestation không được lưu trong events.
    **Aggregate Root**: User Aggregate Root, WebAuthnCredentials Projection
    **Ports:** `IWebAuthnRepository`, `IAttestationVerifier`, `ISignCountStore`

## 5. Ports

### IPasswordHasher

IPasswordHasher chịu trách nhiệm băm và kiểm tra mật khẩu.

- `hash(rawPassword: string): Promise<string>`: Tạo hash mật khẩu (Argon2id in prod).
- `compare(rawPassword: string, hash: string): Promise<boolean>`: So sánh raw password với hash.
- `needsRehash(hash: string): Promise<boolean>`: Kiểm tra xem hash có cần rehash theo policy mới không.

### IUserRepository

Lưu trữ và truy vấn trạng thái User (read/write) cho các command/aggregate.

- `findById(userId: string): Promise<User | null>`: Tìm user theo id.
- `findByEmail(email: string): Promise<User | null>`: Tìm user theo email.
- `findByUsername(username: string): Promise<User | null>`: Tìm user theo username.
- `save(user: User): Promise<void>`: Lưu/ cập nhật user.
- `remove(userId: string): Promise<void>`: Xóa/soft-delete user.

### IVerificationTokenStore

Lưu và xác thực các verification / reset tokens.

- `issueToken(userId: string, type: string, expiresInMs?: number): Promise<string>`: Tạo và lưu token (email verify, password reset).
- `verifyToken(userId: string, token: string, type?: string): Promise<boolean>`: Xác thực token; one-time-use.
- `revokeToken(userId: string, token: string): Promise<void>`: Thu hồi token.

### IEmailSender

Gửi email hệ thống (verification, password reset, templates).

- `sendVerificationEmail(userId: string, email: string, token: string): Promise<void>`: Gửi email xác thực.
- `sendPasswordResetEmail(userId: string, email: string, token: string): Promise<void>`: Gửi email reset mật khẩu.
- `sendTemplate(email: string, templateId: string, data: object): Promise<void>`: Gửi email theo template.

### ITemplateRenderer

Render email templates (used by `IEmailSender`).

- `render(templateId: string, data: object): Promise<string>`: Trả HTML/text đã render.

### IRateLimiter

Rate limit logic for email / sensitive flows.

- `allow(key: string, points?: number): Promise<boolean>`: Kiểm tra/consume quota; trả về `true` nếu được phép.

### IMFAProvider / IMFASecretStore

Providers and storage for MFA (TOTP/SMS) lifecycle.

- `generateTOTPSecret(userId: string): Promise<{secret: string, qr: string}>`: Tạo secret và QR cho TOTP registration.
- `verifyTOTP(userId: string, code: string): Promise<boolean>`: Xác thực TOTP code.

### IWebAuthnRepository / IAttestationVerifier / ISignCountStore

WebAuthn credential storage and attestation verification helpers.

- `saveCredential(userId: string, credential: WebAuthnCredential): Promise<void>`: Lưu metadata publicKey credential.
- `findCredentialById(credentialId: string): Promise<WebAuthnCredential | null>`: Tìm credential theo id.
- `removeCredential(credentialId: string): Promise<void>`: Thu hồi credential.
- `verifyAttestation(attestation: any): Promise<boolean>`: Verify attestation statement (IAttestationVerifier).
- `getSignCount(credentialId: string): Promise<number>`: Lấy signCount; used to detect cloned authenticators.
- `updateSignCount(credentialId: string, newCount: number): Promise<void>`: Cập nhật signCount.

### IEventStore

Source-of-truth event store (EventStoreDB semantics assumed). Adapter must support append and read semantics used by aggregates and workers.

- `append(streamId: string, events: DomainEvent[]): Promise<void>`: Ghi events vào stream (append-only).
- `appendAtomic(writes: AtomicWriteRequest[]): Promise<void>`: Ghi nhiều events vào nhiều stream trong một giao dịch nguyên tử (Multi-Stream Atomic Write). Cần sử dụng $ExpectedVersion cho mỗi stream để thực thi logic khóa (ADR-IAM-7).
- `read(streamId: string, fromPosition?: number, limit?: number): Promise<DomainEvent[]>`: Đọc events từ stream.
- `subscribe(streamId: string, handler: (e: DomainEvent)=>Promise<void>): Promise<Subscription>`: Subscribe / persistent subscription support.

### ISnapshotStore

Snapshot store used to speed up aggregate rehydration (ADR-IAM-5).

- `saveSnapshot(aggregateId: string, snapshot: any, version?: string): Promise<void>`: Lưu snapshot.
- `loadSnapshot(aggregateId: string): Promise<{snapshot: any, version?: string} | undefined>`: Lấy snapshot mới nhất.
- `deleteSnapshot(aggregateId: string): Promise<void>`: Xóa snapshot.
