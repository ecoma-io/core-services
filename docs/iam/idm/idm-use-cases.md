# IDM Bounded Context - Behavior Specifications

## 1. Kịch bản hành vi (Functional Behavior Specifications)

### Register User Account

```gherkin
Feature: Register User Account
	As a New User
	I want to register an account by email (optional username and password)
	So that I have a User identity in the system

	Scenario: Đăng ký thành công (email và username chưa được dùng)
		Given hệ thống không có `User` với `email` đã chuẩn hoá đó
		And (nếu cung cấp) `username` chưa được dùng
		When `RegisterUserCommand` được thực thi với `email`, (optional `username`), và (optional) `password`
		Then tạo `User` mới với `userId`, `email` (normalized), `createdAt` và trạng thái `Active` (hoặc PendingVerification nếu flow yêu cầu)
		And Event: `UserRegisteredEvent` được emit
		And Stream: Event `UserRegisteredEvent` được append vào `iam-user-<userId>` (aggregate stream)
		And Guard Streams (Multi-Stream Atomic Write): đồng thời append (via `IEventStore.appendAtomic`) các sự kiện khóa vào Guard Streams để reserve khóa:
			* `EmailLockAcquiredEvent` -> `unique-email-<hash(normalizedEmail)>`
			* (nếu có username) `UsernameLockAcquiredEvent` -> `unique-username-<hash(username)>`
		And Nếu `password` được cung cấp, mật khẩu phải được băm bằng `Argon2id` trước khi lưu; raw password không được lưu trong event payloads (tham chiếu ADR-IAM-8)

	Scenario: Đăng ký thất bại do email đã tồn tại
		Given đã tồn tại một `User` với `email` chuẩn hoá đó (hoặc email đang được reserve trên Guard Stream)
		And Guard Stream `unique-email-<hash(normalizedEmail)>` đã có khóa
		When `RegisterUserCommand` được thực thi với cùng `email`
		Then không tạo `User` mới; trả về lỗi nghiệp vụ `EmailAlreadyTaken`
		And không có event mới được append vào `iam-user-<userId>` của user mới
```

---

### Verify Email

```gherkin
Feature: Verify Email
	As a User (or system via verification link)
	I want to verify ownership of my email using a token
	So that emailVerified is set true and email can be used as contact/identifier

	Scenario: Xác thực email thành công
		Given `User` tồn tại với `email` chưa được xác thực (`emailVerified = false`)
		And có một verification token hợp lệ và chưa hết hạn được phát bởi `VerificationService`
		When `VerifyEmailCommand` được thực thi với token hợp lệ
		Then `User` được cập nhật `emailVerified = true` và `emailVerifiedAt` được set
		And Event: `UserEmailVerifiedEvent` được emit
		And Stream: `UserEmailVerifiedEvent` được append vào `iam-user-<userId>`

	Scenario: Xác thực email thất bại do token không hợp lệ hoặc hết hạn
		Given `User` tồn tại với `emailVerified = false`
		And token cung cấp không hợp lệ hoặc đã hết hạn
		When `VerifyEmailCommand` được thực thi với token đó
		Then `User` vẫn giữ nguyên `emailVerified = false`
		And trả về lỗi nghiệp vụ `InvalidOrExpiredVerificationToken`
		And không có event `UserEmailVerifiedEvent` nào được append vào `iam-user-<userId>`
```

---

### Update User Profile

```gherkin
Feature: Update User Profile
	As a User
	I want to update my UserProfile (firstName, lastName, avatarUrl, metadata)
	So that display and contact information are up to date

	Scenario: Cập nhật hồ sơ thành công
		Given `User` tồn tại
		When `UpdateUserProfileCommand` được thực thi với `changes` hợp lệ (ví dụ firstName/lastName không rỗng)
		Then `User.profile` được cập nhật theo `changes`
		And Event: `UserProfileUpdatedEvent` được emit
		And Stream: `UserProfileUpdatedEvent` được append vào `iam-user-<userId>`

	Scenario: Cập nhật hồ sơ thất bại do dữ liệu không hợp lệ
		Given `User` tồn tại
		And `changes` chứa `firstName` hoặc `lastName` rỗng
		When `UpdateUserProfileCommand` được thực thi
		Then không cập nhật `User.profile`
		And trả về lỗi nghiệp vụ `InvalidProfileData`
		And không có event `UserProfileUpdatedEvent` được append
```

---

### Change User Password

```gherkin
Feature: Change User Password
	As a User (self-service) or Admin (reset)
	I want to change the password using current password or a reset token
	So that the account remains secure and I can login with the new password

	Scenario: Thay đổi mật khẩu thành công (cung cấp current password)
		Given `User` tồn tại và `passwordHash` hiện có
		And client cung cấp `currentPassword` đúng
		When `ChangeUserPasswordCommand` được thực thi với `currentPassword` và `newPassword`
		Then `newPassword` được băm bằng `Argon2id` trước khi lưu (không lưu raw password)
		And `User.passwordHash` được cập nhật
		And Event: `UserPasswordChangedEvent` được emit (chỉ chứa `passwordHash` mới)
		And Stream: `UserPasswordChangedEvent` được append vào `iam-user-<userId>`

	Scenario: Thay đổi mật khẩu thất bại do `currentPassword` sai
		Given `User` tồn tại với `passwordHash` hiện tại
		And client cung cấp `currentPassword` sai
		When `ChangeUserPasswordCommand` được thực thi
		Then không cập nhật `passwordHash`
		And trả về lỗi nghiệp vụ `InvalidCurrentPassword`
		And không có event `UserPasswordChangedEvent` được append vào `iam-user-<userId>`
```

---

### Manage MFA (TOTP)

```gherkin
Feature: Manage MFA (TOTP)
	As a User
	I want to register, confirm and disable TOTP MFA
	So that my account security is strengthened

	Scenario: Bắt đầu đăng ký TOTP (issue secret) thành công
		Given `User` tồn tại và chưa bật `mfaEnabled`
		When `EnableMFACommand` được thực thi
		Then `MFAService.generateTOTPSecret` trả về `secret` và `qr` cho client (raw secret chỉ trả cho client, không lưu unencrypted)
		And không có event `MFAEnabledEvent` được ghi ngay lập tức (chờ xác nhận)

	Scenario: Xác nhận TOTP thành công và bật MFA
		Given `User` đã nhận `secret` từ bước đăng ký và `mfaEnabled = false`
		And client gửi mã TOTP hợp lệ để xác nhận
		When `ConfirmMFACommand` được thực thi với mã hợp lệ
		Then hệ thống lưu `encryptedSecret` và `mfaEnabled = true`
		And Event: `MFAEnabledEvent` (chứa `encryptedSecret`) được emit
		And Stream: `MFAEnabledEvent` được append vào `iam-user-<userId>`

	Scenario: Xác nhận TOTP thất bại do mã sai
		Given `User` đang trong trạng thái pending TOTP registration
		And mã TOTP cung cấp không hợp lệ
		When `ConfirmMFACommand` được thực thi
		Then `mfaEnabled` vẫn là `false`
		And trả về lỗi `InvalidMfaCode`
		And không có event `MFAEnabledEvent` được append
```

---

### Lock / Unlock User Account

```gherkin
Feature: Lock / Unlock User Account
	As a System (rate limiter) or Admin
	I want to lock accounts when suspicious behavior is detected and unlock when needed
	So that account security is preserved

	Scenario: Khóa tài khoản tự động do nhiều lần đăng nhập thất bại
		Given `User` tồn tại và có nhiều lần đăng nhập thất bại vượt ngưỡng
		When `LockUserAccountCommand` được thực thi (by system)
		Then `User.accountStatus` set `Locked`
		And Event: `UserAccountLockedEvent` được emit (chứa `lockedAt` và `reason`)
		And Stream: `UserAccountLockedEvent` được append vào `iam-user-<userId>`

	Scenario: Mở khóa tài khoản bởi Admin
		Given `User.accountStatus = Locked`
		When `UnlockUserAccountCommand` được thực thi bởi Admin
		Then `User.accountStatus` set `Active`
		And Event: `UserAccountUnlockedEvent` được emit
		And Stream: `UserAccountUnlockedEvent` được append vào `iam-user-<userId>`
```

---

### Delete User Account

````gherkin
Feature: Delete User Account
	As a User (self-service) or Admin
	I want to soft-delete the account and release keys (email, username) atomically
	So that email/username can be reused according to policy

	Scenario: Xóa tài khoản thành công (Atomic Key Release)
		Given `User` tồn tại (có `email` và có thể có `username`)
		When `DeleteUserAccountCommand` được thực thi
		Then `User.deletedAt` được set và `accountStatus` set `Deleted`
		And Event: `UserAccountDeletedEvent` được emit và append vào `iam-user-<userId>`
		And Guard Streams (Multi-Stream Atomic Write): đồng thời append (via `IEventStore.appendAtomic`) các sự kiện giải phóng khóa để release key:
			* `EmailLockReleasedEvent` -> `unique-email-<hash(normalizedEmail)>`
			* (nếu có username) `UsernameLockReleasedEvent` -> `unique-username-<hash(username)>`
		And toàn bộ ghi này phải thực hiện nguyên tử (atomic) để đảm bảo ràng buộc unique được cập nhật (tham chiếu ADR-IAM-7)

	Scenario: Xóa tài khoản thất bại do precondition (ví dụ user đang có pending takeover)
		Given `User` tồn tại nhưng có ràng buộc business (ví dụ đang có transaction takeover hoặc Guard Stream trong trạng thái không cho release ngay)
		When `DeleteUserAccountCommand` được thực thi
		Then không thực hiện xóa; trả về lỗi nghiệp vụ `CannotDeleteUserDueToPendingTakeover`
		And không có event `UserAccountDeletedEvent` hay `EmailLockReleasedEvent`/`UsernameLockReleasedEvent` được append

---

### Change Email (Initiate / Confirm / Cancel)

```gherkin
Feature: Change Email
	As a User
	I want to change my account email using verification and Guard Stream reservation
	So that new email is reserved and swapped atomically when confirmed

	Scenario: Khởi tạo đổi email (reserve new email)
		Given `User` tồn tại và muốn đổi `email` sang `newEmail`
		And `newEmail` đã được normalized
		When `InitiateEmailChangeCommand` được thực thi với `newEmail`
		Then tạo `EmailChangeInitiatedEvent` với `newEmail`, `requestedAt`, `expiresAt` (optional)
		And Guard Streams (Multi-Stream Atomic Write): append `EmailLockAcquiredEvent` -> `unique-email-<hash(normalizedNewEmail)>`
		And Stream: `EmailChangeInitiatedEvent` được append vào `iam-user-<userId>`

	Scenario: Khởi tạo đổi email thất bại do `newEmail` đã có khóa
		Given Guard Stream `unique-email-<hash(normalizedNewEmail)>` đã có khóa
		When `InitiateEmailChangeCommand` được thực thi
		Then trả về lỗi nghiệp vụ `EmailAlreadyTaken`
		And không có event `EmailChangeInitiatedEvent` được append

	Scenario: Xác nhận đổi email thành công (confirm)
		Given `User` đã có `EmailChangeInitiatedEvent` pending cho `newEmail`
		And client có verification token hợp lệ cho `newEmail`
		When `ConfirmEmailChangeCommand` được thực thi với token hợp lệ
		Then append atomically (via `IEventStore.appendAtomic`) vào:
			* `EmailChangedEvent` -> `iam-user-<userId>` (chứa `oldEmail`, `newEmail`, `changedAt`)
			* `EmailLockReleasedEvent` -> `unique-email-<hash(normalizedOldEmail)>` (nếu có)
		And projection/Read Model cập nhật email chính thức
		And emit revocation hint: include `initiatedBy` and `revocationHints` so ACM may revoke affected sessions

	Scenario: Hủy đổi email trước khi xác nhận (cancel)
		Given `EmailChangeInitiatedEvent` tồn tại và chưa được confirm
		When `CancelEmailChangeCommand` được thực thi bởi owner
		Then append `EmailChangeCancelledEvent` vào `iam-user-<userId>` và release guard lock `EmailLockReleasedEvent` -> `unique-email-<hash(normalizedNewEmail)>`
````

---

### Password Reset (SSPR)

```gherkin
Feature: Password Reset (SSPR)
	As a User
	I want to request and use a password reset token
	So that I can recover access without exposing raw passwords

	Scenario: Yêu cầu reset mật khẩu (issue token)
		Given `User` tồn tại với `email` đã xác thực
		When `RequestPasswordResetCommand` được thực thi
		Then `VerificationService.issueVerificationToken(userId, 'password_reset')` được gọi và trả về `token` và `expiresAt`
		And an email with reset link/token được gửi đến `email`

	Scenario: Reset mật khẩu thành công bằng token
		Given tồn tại token reset hợp lệ và chưa hết hạn cho `userId`
		When `ResetPasswordWithTokenCommand` được thực thi với `token` và `newPassword`
		Then `newPassword` được băm bằng `Argon2id` và `UserPasswordChangedEvent` được emit (chỉ chứa `passwordHash`, `changedAt`)
		And emit revocation hint so ACM can revoke sessions (e.g. `invalidateAllSessions: true`)
		And token được mark as used (one-time)

	Scenario: Reset mật khẩu thất bại do token không hợp lệ hoặc hết hạn
		Given token không hợp lệ hoặc đã hết hạn
		When `ResetPasswordWithTokenCommand` được thực thi
		Then trả về lỗi nghiệp vụ `InvalidOrExpiredVerificationToken`
		And không có event `UserPasswordChangedEvent` được append
```

---

### Change Username

```gherkin
Feature: Change Username
	As a User
	I want to change my username (optional) with uniqueness guarantees
	So that my username follows domain rules and remains unique

	Scenario: Thay đổi username thành công
		Given `User` tồn tại và `username` hiện có
		And `newUsername` tuân theo format rules
		When `ChangeUsernameCommand` được thực thi với `newUsername`
		Then append atomically: `UsernameLockAcquiredEvent` -> `unique-username-<hash(newUsername)>` and `UsernameChangedEvent` -> `iam-user-<userId>`

	Scenario: Thay đổi username thất bại do format không hợp lệ
		Given `newUsername` không thỏa định dạng (VD: separator liên tiếp, quá dài)
		When `ChangeUsernameCommand` được thực thi
		Then trả về lỗi nghiệp vụ `InvalidUsernameFormat`
		And không có event `UsernameChangedEvent` được append

	Scenario: Thay đổi username thất bại do username đã bị chiếm
		Given Guard Stream `unique-username-<hash(newUsername)>` đã có khóa
		When `ChangeUsernameCommand` được thực thi
		Then trả về lỗi nghiệp vụ `UsernameAlreadyTaken`
```

---

### Disable MFA

```gherkin
Feature: Disable MFA
	As a User
	I want to disable an existing MFA method
	So that I can remove a device/method from my account

	Scenario: Tắt MFA thành công
		Given `User.mfaEnabled = true` và có `mfaMethod`
		When `DisableMFACommand` được thực thi bởi owner
		Then `MFADisabledEvent` được emit (chứa `method`, `disabledAt`)
		And Stream: `MFADisabledEvent` được append vào `iam-user-<userId>`
```

---

### Atomic Takeover (Competing Claim)

```gherkin
Feature: Atomic Takeover / UserAccountExpired
	As the system
	I want to support atomic takeover of email/username by another account
	So that unique-key ownership can be transferred safely and the old account can be expired

	Scenario: Takeover succeeds (User B claims key owned by User A)
		Given `UserA` tồn tại với `email` (or `username`) và lock expired or policy allows takeover
		And `UserB` thực hiện register/change to claim that same key
		When takeover atomic write completes
		Then append atomically:
			* `UserRegisteredEvent`/`EmailChangedEvent` for UserB
			* `UserAccountExpiredEvent` for UserA (contains `expiredKey`, `takeoverByUserId`, `expiredAt`)
			* appropriate Guard Stream lock/release events

	Scenario: Takeover blocked due to policy or active reservation
		Given Guard Stream or business rule prevents takeover
		When `UserB` attempts to claim key
		Then return `EmailAlreadyTaken` or `CannotTakeoverDueToPolicy`
```

## 2. Yêu cầu phi chức năng (Non-functional Behavior Specifications)

### IDM Command Liveness Health Check

```gherkin
Feature: Azm Command Liveness Health Check
	Scenario: Kiểm tra liveness healthy trả về trạng thái healthy
		Given tiến trình dịch vụ `idm-command` đã được khởi động và đang chạy
		When operator hoặc orchestrator gọi `GET /health/liveness`
		Then dịch vụ trả về HTTP 200
		And nội dung response có trường `message` = "Service still alive"
```

### IDM Command Readiness Health Check

```gherkin
Feature: Azm Command Readiness Health Check
	Scenario: Kiểm tra readiness healthy trả về trạng thái healthy
		When operator hoặc orchestrator gọi `GET /health/ready` trên `idm-command`
		Then dịch vụ trả về HTTP 200
		And body của response là `ISuccessResponse<HealthDetails>` với `data` ánh xạ các keys component tới `ServiceHealthStatus.UP` (ví dụ `{ eventstoredb: 'up' }`)

	Scenario: Readiness khi EventStoreDB (event store) bị down
		Given EventStoreDB (event store) không khả dụng cho `idm-command`
		When operator gọi `GET /health/ready` trên `idm-command`
		Then dịch vụ trả về HTTP 503
		And body của response là `IErrorResponse<HealthDetails>` với `details` chứa `{ eventstoredb: ServiceHealthStatus.DOWN }`

	Scenario: Readiness khi RabbitMQ (message bus) bị down (non-critical for write path)
		Given RabbitMQ (message bus) không khả dụng nhưng EventStoreDB vẫn UP
		When operator gọi `GET /health/ready` trên `idm-command`
		Then dịch vụ có thể trả HTTP 200 (ready with degraded) hoặc HTTP 503 tuỳ cấu hình
		And body nên phản ánh `data.rabbitmq` = `ServiceHealthStatus.UNKNOWN` hoặc `DOWN` theo policy
```

### IDM Query Liveness Health Check

```gherkin
Feature: Azm Query Liveness Health Check
	Scenario: Kiểm tra liveness của `idm-query`
		Given tiến trình dịch vụ `idm-query` đã được khởi động và đang chạy
		When operator hoặc orchestrator gọi `GET /health/liveness` trên `idm-query`
		Then dịch vụ trả về HTTP 200
		And nội dung response có trường `message` = "Service still alive"
```

### IDM Query Readiness Health Check

```gherkin
Feature: Azm Query Readiness Health Check
	Scenario: Kiểm tra readiness healthy cho `idm-query`
		When operator gọi `GET /health/ready` trên `idm-query`
		Then dịch vụ trả về HTTP 200
		And body của response là `ISuccessResponse<HealthDetails>` với `data` ánh xạ các keys component tới `ServiceHealthStatus.UP` (ví dụ `{ postgresql: 'up', redis: 'up', elasticsearch: 'up' }`) và optional `metadata.checkedAt`

	Scenario: Readiness khi PostgreSQL (read models) cho `idm-query` bị down
		Given PostgreSQL (read models) không khả dụng cho `idm-query`
		When operator gọi `GET /health/ready` trên `idm-query`
		Then dịch vụ trả về HTTP 503
		And body của response là `IErrorResponse<HealthDetails>` với `details` chứa `{ postgresql: ServiceHealthStatus.DOWN }`

	Scenario: Readiness khi Redis (cache) cho `idm-query` bị down
		Given Redis (cache) không khả dụng cho `idm-query`
		When operator gọi `GET /health/ready` trên `idm-query`
		Then dịch vụ trả về HTTP 503
		And body của response là `IErrorResponse<HealthDetails>` với `details` chứa `{ redis: ServiceHealthStatus.DOWN }`

	Scenario: Readiness khi Elasticsearch (search/index) cho `idm-query` bị down (degraded)
		Given Elasticsearch (search/index) không khả dụng cho `idm-query`
		When operator gọi `GET /health/ready` trên `idm-query`
		Then dịch vụ trả về HTTP 200
		And body của response là `ISuccessResponse<HealthDetails>` trong đó `data.elasticsearch` là `ServiceHealthStatus.UNKNOWN` và thông điệp tổng thể chỉ ra `ready (degraded)`
```

### IDM Projector Liveness Health Check

```gherkin
Feature: Azm Projector Liveness Health Check
	Scenario: Kiểm tra liveness của `idm-projector`
		Given tiến trình dịch vụ `idm-projector` đã được khởi động và đang chạy
		When operator hoặc orchestrator gọi `GET /health/liveness` trên `idm-projector`
		Then dịch vụ trả về HTTP 200
		And nội dung response có trường `message` = "Service still alive"
```

### IDM Projector Readiness Health Check

```gherkin
Feature: Azm Projector Readiness Health Check
	Scenario: Kiểm tra readiness healthy cho `idm-projector`
		When operator gọi `GET /health/ready` trên `idm-projector`
		Then dịch vụ trả về HTTP 200
		And body của response là `ISuccessResponse<HealthDetails>` với `data` ánh xạ các keys component tới `ServiceHealthStatus.UP` (ví dụ `{ eventstoredb: 'up', postgresql: 'up', redis: 'up', rabbitmq: 'up', elasticsearch: 'up' }`) và optional `metadata.checkedAt`

	Scenario: Readiness khi EventStoreDB (event store) cho `idm-projector` bị down
		Given EventStoreDB (event store) không khả dụng cho `idm-projector`
		When operator gọi `GET /health/ready` trên `idm-projector`
		Then dịch vụ trả về HTTP 503
		And body của response là `IErrorResponse<HealthDetails>` với `details` chứa `{ eventstoredb: ServiceHealthStatus.DOWN }`

	Scenario: Readiness khi PostgreSQL (projections) cho `idm-projector` bị down
		Given PostgreSQL (projections) không khả dụng cho `idm-projector`
		When operator gọi `GET /health/ready` trên `idm-projector`
		Then dịch vụ trả về HTTP 503
		And body của response là `IErrorResponse<HealthDetails>` với `details` chứa `{ postgresql: ServiceHealthStatus.DOWN }`

	Scenario: Readiness khi Redis hoặc RabbitMQ cho `idm-projector` bị down
		Given Redis hoặc RabbitMQ không khả dụng cho `idm-projector`
		When operator gọi `GET /health/ready` trên `idm-projector`
		Then dịch vụ trả về HTTP 503
		And body của response là `IErrorResponse<HealthDetails>` với `details` chứa `{ redis: ServiceHealthStatus.DOWN }` or `{ rabbitmq: ServiceHealthStatus.DOWN }` accordingly

	Scenario: Readiness khi Elasticsearch (indexing) cho `idm-projector` bị down (degraded)
		Given Elasticsearch (indexing) không khả dụng cho `idm-projector`
		When operator gọi `GET /health/ready` trên `idm-projector`
		Then dịch vụ trả về HTTP 200
		And body của response là `ISuccessResponse<HealthDetails>` trong đó `data.elasticsearch` là `ServiceHealthStatus.UNKNOWN` (degraded) và thông điệp tổng thể chỉ ra `ready (degraded)`
```

## 3. Commands

Phần này mô tả tập hợp các Command chính của Bounded Context `IDM`, bao gồm cấu trúc payload, ràng buộc validate cơ bản, aggregate chịu trách nhiệm, các sự kiện liên quan và các lưu ý thực thi (atomic write, Guard Streams, hashing, v.v.). Các Command handlers phải tuân thủ invariant và các ADR đã nêu trong `idm-domain-model.md` và `iam-architecture.md` (ví dụ: Guard Streams + `IEventStore.appendAtomic` để enforce unique constraints — ADR-IAM-7).

### RegisterUserCommand

Tạo mới User

    - Payload: `email: string`, `username?: string`, `password?: string`, `profile?: UserProfile`, `requestedBy?: UserId`
    - Validate: `email` required, normalized, unique; `username` format + unique (nếu có); `password` strong per policy (if provided)
    - Aggregate: `User` (`iam-user-<userId>`)
    - Side-effects / Events: `UserRegisteredEvent` + Guard Stream events (`EmailLockAcquiredEvent`, optional `UsernameLockAcquiredEvent`) written atomically via `appendAtomic`.
    - Notes: Hash `password` via `IPasswordHasher` before creating event payload; never include raw password in events.

### VerifyEmailCommand / ConfirmEmailChangeCommand

Xác thực email hoặc confirm change

    - Payload: `userId: string`, `token: string` (+ for confirm: context to map pending `newEmail`)
    - Validate: token validity via `IVerificationTokenStore` / `VerificationService`.
    - Aggregate: `User`
    - Side-effects / Events: `UserEmailVerifiedEvent` (for verify), or atomic pair `EmailChangedEvent` + `EmailLockReleasedEvent` (for confirm) written via `appendAtomic` when releasing old locks.

### InitiateEmailChangeCommand

Reserve new email and start verification

    - Payload: `userId: string`, `newEmail: string`, `requestedBy?: UserId`
    - Validate: `newEmail` normalized + not currently reserved (Guard Stream check)
    - Aggregate: `User`
    - Side-effects / Events: `EmailChangeInitiatedEvent` + `EmailLockAcquiredEvent` -> append atomically (reserve the new email on `unique-email-<hash(normalizedNewEmail)>`).

### CancelEmailChangeCommand

Cancel pending email change and release reservation

    - Payload: `userId: string`, `newEmail: string`, `requestedBy?: UserId`
    - Side-effects / Events: `EmailChangeCancelledEvent` + `EmailLockReleasedEvent` for the pending new email (atomic where appropriate).

### ChangeUsernameCommand

Change username with uniqueness guarantees

    - Payload: `userId: string`, `newUsername: string`, `requestedBy?: UserId`
    - Validate: `newUsername` format rules + uniqueness via Guard Stream
    - Aggregate: `User`
    - Side-effects / Events: `UsernameLockAcquiredEvent` -> `unique-username-<hash(newUsername)>` and `UsernameChangedEvent` appended atomically to ensure unique swap.

### UpdateUserProfileCommand

Update user's profile data

    - Payload: `userId: string`, `changes: Partial<UserProfile>`, `requestedBy?: UserId`
    - Validate: `firstName`/`lastName` non-empty if provided
    - Aggregate: `User`
    - Side-effects / Events: `UserProfileUpdatedEvent`

### ChangeUserPasswordCommand / ResetPasswordWithTokenCommand

Change or reset user's password

    - Payload (change): `userId`, `currentPassword`, `newPassword` ; (reset): `userId`, `token`, `newPassword`
    - Validate: current password check or token validity; `newPassword` strength
    - Aggregate: `User`
    - Side-effects / Events: `UserPasswordChangedEvent` (contains new `passwordHash` only)
    - Notes: Use `IPasswordHasher.hash` before emitting event; include revocation hint so ACM can revoke sessions if necessary.

### RequestPasswordResetCommand

Issue password reset token and notify user

    - Payload: `userId` or `email`
    - Side-effects: Calls `VerificationService.issueVerificationToken` and triggers an email via `IEmailSender`; no direct domain event required here (implementation may emit an audit event or projection-only event depending on policy).

### EnableMFACommand / ConfirmMFACommand / DisableMFACommand

Manage MFA lifecycle (issue/confirm/disable)

    - Payload (enable): `userId`; (confirm): `userId`, `code`; (disable): `userId`, `method?`
    - Validate: user exists; code validity for confirm
    - Aggregate: `User`
    - Side-effects / Events: `MFAEnabledEvent` (with `encryptedSecret`) on confirm; `MFADisabledEvent` on disable. `EnableMFACommand` typically returns a transient secret/QR but does not emit event until confirmation.

### LockUserAccountCommand / UnlockUserAccountCommand

Lock or unlock a user account

    - Payload: `userId`, `reason?`, `actorId?`
    - Aggregate: `User`
    - Side-effects / Events: `UserAccountLockedEvent`, `UserAccountUnlockedEvent`

### DeleteUserAccountCommand

Soft-delete account and release keys atomically

    - Payload: `userId`, `requestedBy?: UserId`
    - Validate: preconditions (no blocking takeover, business rules)
    - Aggregate: `User`
    - Side-effects / Events: `UserAccountDeletedEvent` appended to `iam-user-<userId>` AND Guard Stream releases (`EmailLockReleasedEvent`, optional `UsernameLockReleasedEvent`) appended atomically via `IEventStore.appendAtomic` to ensure key release (see ADR-IAM-7 and `idm-domain-model.md`).

### AtomicTakeoverCommand (or implicit via register/change)

Atomic takeover flow for claiming expired/claimable keys

    - Purpose: Support the atomic flow where a new user claims an expired/claimable key and the old account is expired.
    - Side-effects / Events: multi-stream atomic write that creates `UserRegisteredEvent` / `EmailChangedEvent` for new owner and `UserAccountExpiredEvent` for previous owner together with appropriate Guard Stream lock/release events.

## 4. Queries

Phần này mô tả các Query (read-side endpoints / projections) cần thiết để hỗ trợ các Behavior Specifications ở mục 1. Các Query tập trung vào Read Models do `idm-projection` materialize (Postgres/Elasticsearch), hoặc là calls/ports (ví dụ token verification, Guard Stream checks) mà Command handlers phải sử dụng.

### GetUserById

Lấy trạng thái hiện tại của User (read model) theo `userId`.

    - Payload: `userId: string`
    - Returns: `User` read model (fields: `userId`, `email`, `username?`, `profile`, `accountStatus`, `emailVerified`, `emailVerifiedAt?`, `mfaEnabled`, `mfaMethod?`, `createdAt`, `updatedAt`, `deletedAt?`)
    - Source: `idm-projection` (Postgres read model materialized from `iam-user-<userId>` stream)
    - Notes: Use for precondition checks in many Commands (password change, MFA flows, delete, lock/unlock). Read-model may be eventually consistent (RYOW) — for uniqueness and atomic operations rely on Guard Streams + `IEventStore.appendAtomic` at write time.

### FindUserByEmail

Lookup user by normalized email (existence / details).

    - Payload: `email: string` (should be normalized)
    - Returns: `User` read model or `null` if none
    - Source: `idm-projection` (indexed by normalized email)
    - Notes: Useful for registration UX, password reset lookup. Do not rely on this alone for uniqueness enforcement.

### FindUserByUsername

Lookup user by username.

    - Payload: `username: string`
    - Returns: `User` read model or `null`
    - Source: `idm-projection` (indexed by username)
    - Notes: Similar to email lookup; uniqueness enforcement is via Guard Streams.

### CheckEmailAvailability / CheckUsernameAvailability

Convenience endpoints for UI to check availability. These wrap read-model lookups and should present eventual-consistency caveats.

    - Payload: `email: string` OR `username: string`
    - Returns: `{ available: boolean, reason?: string }`
    - Source: `idm-projection` (read model) — optionally augmented by a reservation indicator projection
    - Notes: Because of eventual consistency, clients should treat a positive availability result as advisory and still handle `EmailAlreadyTaken`/`UsernameAlreadyTaken` errors returned by commands.

### GetPendingEmailChange

Query pending email-change request for a user.

    - Payload: `userId: string`
    - Returns: pending change object or `null` (fields: `newEmail`, `requestedAt`, `expiresAt`, `requestedBy`)
    - Source: `idm-projection` (can be part of user read model or a separate pending-changes projection)
    - Notes: Used by `ConfirmEmailChangeCommand` / `CancelEmailChangeCommand` flows.

### GetMfaStatus

Return MFA registration state for a user.

    - Payload: `userId: string`
    - Returns: `{ mfaEnabled: boolean, mfaMethod?: string, pendingRegistration?: boolean }`
    - Source: `idm-projection`
    - Notes: Used by Enable/Confirm/Disable MFA flows and UI.

### VerifyTokenStatus (port)

Check verification/password-reset token validity. This is a port/service call, not a projection query.

    - Payload: `userId: string`, `token: string`, `type?: 'email' | 'password_reset'`
    - Returns: `{ valid: boolean, reason?: string }`
    - Source: `IVerificationTokenStore` / `VerificationService` (port)
    - Notes: Command handlers call this service to validate tokens before emitting events.

### GetUserSessions (cross-BC)

List sessions for a user — used when commands emit revocation hints or admin-triggered revocations.

    - Payload: `userId: string`, optional `filters`
    - Returns: array of session metadata (sessionId, clientId, createdAt, lastSeen, active)
    - Source: ACM projections / cross-BC read models
    - Notes: IDM emits revocation hints in events; ACM is typically the owner of sessions. This Query may be implemented in ACM and consumed by admin UIs.

### GetGuardStreamStatus (conceptual / port)

Check whether a Guard Stream (e.g., `unique-email-<hash(email)>` or `unique-username-<hash(username)>`) currently holds a reservation. This is not a typical HTTP query — it's a check performed by Command Handlers against `IEventStore`/Guard Streams.

    - Payload: stream identifier (e.g., `unique-email-<hash(normalizedEmail)>`)
    - Returns: `{ reserved: boolean, owner?: string, reservationExpiresAt?: Date }` (implementation-dependent)
    - Source: `IEventStore` / Guard Streams
    - Notes: Must be used together with atomic writes (`appendAtomic` + expected version) to guarantee uniqueness.

### GetAccountPreconditions / GetPendingTakeoverInfo

Query for business preconditions that block operations (e.g., pending takeover flags, pending transactions).

    - Payload: `userId: string`
    - Returns: `{ canDelete: boolean, reasons?: string[], pendingTakeover?: { byUserId: string, expiresAt?: Date } }`
    - Source: `idm-projection` (or a small business-rules projection)
    - Notes: Used by `DeleteUserAccountCommand` precondition checks.

---

## 5. Workflows

### Giới thiệu

Trong kiến trúc IDM, nhiều hành vi nghiệp vụ là các quy trình nhiều bước, có trạng thái trung gian, cần điều phối qua nhiều aggregate/stream và có thể kéo dài theo thời gian (pending, timeout, retry, xác nhận, huỷ, v.v.). Các workflow này đảm bảo tính nhất quán, atomicity và trải nghiệm người dùng xuyên suốt các bước nghiệp vụ.

### Danh sách các Workflow chính

- **Đăng ký tài khoản & xác thực email:**
  - RegisterUserCommand → UserRegisteredEvent, EmailLockAcquiredEvent, gửi email xác thực.
  - Chờ VerifyEmailCommand, xác thực thành công thì cập nhật trạng thái, phát UserEmailVerifiedEvent.
  - Nếu quá hạn chưa xác thực, có thể gửi reminder hoặc huỷ đăng ký (tuỳ chính sách).

- **Đổi email:**
  - InitiateEmailChangeCommand → EmailChangeInitiatedEvent, EmailLockAcquiredEvent, gửi email xác thực.
  - Chờ ConfirmEmailChangeCommand hoặc CancelEmailChangeCommand.
  - Khi xác nhận, thực hiện atomic key swap: EmailChangedEvent, EmailLockReleasedEvent.
  - Nếu quá hạn chưa xác nhận, workflow có thể tự động huỷ và release lock.

- **Đặt lại mật khẩu:**
  - RequestPasswordResetCommand → phát token, gửi email.
  - Chờ ResetPasswordWithTokenCommand, xác thực token, đổi mật khẩu, phát UserPasswordChangedEvent.
  - Nếu token hết hạn hoặc đã dùng, workflow đảm bảo revoke token.

- **Quản lý MFA:**
  - EnableMFACommand → phát secret, chờ ConfirmMFACommand.
  - Khi xác nhận thành công, phát MFAEnabledEvent; nếu huỷ hoặc timeout, không enable.
  - DisableMFACommand phát MFADisabledEvent.

- **Atomic Takeover:**
  - Khi có yêu cầu takeover (email/username hết hạn), workflow điều phối việc ghi đè lock, phát UserAccountExpiredEvent, UserRegisteredEvent/EmailChangedEvent, đảm bảo atomicity.

- **Xoá tài khoản:**
  - DeleteUserAccountCommand → kiểm tra precondition, nếu hợp lệ thì phát UserAccountDeletedEvent, EmailLockReleasedEvent, UsernameLockReleasedEvent (nếu có), atomic write.
  - Nếu có pending takeover hoặc ràng buộc khác, workflow đảm bảo không thực hiện xoá.

---

## 6. Process Manager

### Giới thiệu

Process Manager (Saga/Orchestrator) đóng vai trò điều phối các bước trong workflow, lắng nghe sự kiện, phát sinh command tiếp theo, xử lý timeout, retry, hoặc các side-effect liên quan đến nhiều aggregate/stream.

### Đề xuất các Process Manager

- **EmailVerificationProcessManager:** Theo dõi trạng thái xác thực email, timeout, retry, phát reminder hoặc huỷ nếu quá hạn.
- **EmailChangeProcessManager:** Điều phối luồng đổi email, quản lý pending, timeout, huỷ hoặc xác nhận, đảm bảo atomic key swap.
- **PasswordResetProcessManager:** Quản lý phát token, theo dõi trạng thái sử dụng token, timeout, revoke token nếu quá hạn.
- **MFAManagementProcessManager:** Theo dõi trạng thái enable/confirm/disable MFA, xử lý các bước xác nhận.
- **AtomicTakeoverProcessManager:** Điều phối takeover khi key hết hạn, đảm bảo atomic multi-stream write, xử lý concurrency.
- **AccountDeletionProcessManager:** Theo dõi trạng thái xoá tài khoản, kiểm tra precondition, phát các event release lock.

### Lưu ý thực thi

- Các process manager nên được triển khai dưới dạng event-driven, subscribe các event liên quan, lưu trạng thái process (saga state), đảm bảo idempotency và khả năng retry.
- Có thể bổ sung bảng trạng thái process (process state table) để tracking các workflow dài hơi.
