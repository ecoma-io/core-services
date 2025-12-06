# ADR-IAM-7 — Chiến lược Triển khai Ràng buộc Duy nhất (Unique Constraints) Bằng Guard Streams và Atomic Key Swap trong EventStoreDB

## **1. Bối cảnh**

Trong hệ thống CQRS \+ Event Sourcing, sử dụng EventStoreDB (ESDB) làm Source-of-Truth append-only, việc đảm bảo tính duy nhất cho các giá trị như email, username, hoặc các external IDs là bắt buộc. ESDB không hỗ trợ ràng buộc uniqueness global, đòi hỏi một cơ chế tại tầng ứng dụng (Write Model) để thực thi invariant "giá trị là duy nhất" ngay tại thời điểm ghi (**write-time enforcement**).

Thử thách lớn nhất nảy sinh khi người dùng muốn thay đổi một thuộc tính duy nhất (ví dụ: đổi email, đổi username...). Thao tác này đòi hỏi hệ thống phải thực hiện hai hành động logic: giải phóng khóa cũ và giành khóa mới. Để tránh **race conditions** dẫn đến duplicate unique values, quá trình này phải diễn ra một cách **nguyên tử (all-or-nothing)**, hay còn gọi là **Atomic Key Swap**.

Yêu cầu chính:

- Đảm bảo **Strong Consistency** cho các ràng buộc duy nhất tại thời điểm tạo (initial acquisition) và thay đổi (key swap).
- Thực hiện **Atomic Key Swap** (giải phóng khóa cũ và giành khóa mới) một cách nguyên tử.
- Hỗ trợ **idempotent retries** và các flow nghiệp vụ phức tạp như **PendingVerification** và **Atomic Takeover** (giành khóa hết hạn).
- Tránh **Distributed Transaction** và rủi ro **Projector Lag Risk**.
- Đơn giản hóa vận hành và **auditing** toàn bộ lifecycle của khóa.

## **2. Quyết định**

## **1.1. Định nghĩa Kiến trúc & Phạm vi (Ubiquitous Language)**

Ở mức kiến trúc, ADR này giữ các định nghĩa ngắn gọn để đảm bảo sự thống nhất giữa các bên tham gia mà không đi vào chi tiết triển khai. Các khái niệm sau được dùng trong toàn bộ văn bản:

- **Guard Stream:** stream phụ trợ đại diện cho quyền sở hữu một giá trị duy nhất (ví dụ: một địa chỉ email hoặc username).
- **Acquired:** trạng thái cho thấy một Aggregate đã dự trữ/chiếm giữ giá trị trên Guard Stream.
- **Released:** trạng thái biểu thị giá trị đã được chủ sở hữu giải phóng trên Guard Stream.
- **PendingVerification:** trạng thái tạm giữ (reservation) cho các giá trị cần xác thực (ví dụ email chưa được xác minh).
- **Verified:** trạng thái cho thấy giá trị đã được xác thực (nếu có flow xác thực).
- **Expired:** trạng thái chỉ rằng reservation đã vượt quá thời hạn (expiresAt) và có thể bị giành lại theo chính sách kiến trúc.
- **Atomic Takeover:** thao tác nguyên tử ghi đè/giành lại khóa từ holder cũ về holder mới, thường đi kèm với các thay đổi trạng thái aggregate liên quan.

Ghi chú về phạm vi: các mô tả trên là khái niệm kiến trúc. Những chi tiết triển khai (payload schema, định dạng timestamp, thuật toán canonicalization, cơ chế idempotency cụ thể, mức thresholds giám sát, hoặc cơ chế GC/retention) được để cho spec triển khai hoặc tài liệu vận hành, không được cố định trong ADR này.

## **1.2. Mô hình trạng thái Khóa (tóm tắt kiến trúc)**

Ở mức kiến trúc, khóa trên Guard Stream được coi là có một mô hình trạng thái tối giản để mô tả luồng nghiệp vụ: **Acquired → (PendingVerification) → Verified → Released** hoặc **Acquired → Expired → Available**. "Atomic Takeover" là thao tác chuyển từ trạng thái Expired (hoặc trạng thái chấp nhận được theo chính sách kiến trúc) sang Acquired cho holder mới, và được hiểu là một hành động nguyên tử bao gồm cả cập nhật aggregate liên quan.

## **1.3. Semantics của expiresAt (ghi chú kiến trúc)**

`expiresAt` được đề cập ở mức khái niệm như "điểm thời gian mà reservation không còn hợp lệ" và là điều kiện quyết định quyền tiến hành Atomic Takeover. Định dạng timestamp, xử lý clock-skew và khoảng chờ (grace period) là chi tiết triển khai và không được cố định bởi ADR này.

## **1.4. Semantics của ExpectedVersion (ghi chú kiến trúc)**

Ký hiệu `$ExpectedVersion: N`/`M` trong các ví dụ dùng để diễn đạt nguyên tắc kiểm tra phiên bản (optimistic concurrency) trước khi thực hiện ghi nguyên tử. Cách biểu diễn và giá trị cụ thể phụ thuộc vào backend event store; ADR chỉ giữ khái niệm kiểm tra phiên bản để đảm bảo atomicity.

## **1.5. Idempotency (ghi chú kiến trúc)**

Yêu cầu hỗ trợ retry idempotent được ghi nhận ở mức kiến trúc: command handlers cần được thiết kế để chấp nhận retry có chủ ý mà không gây hiệu ứng phụ ngoài ý muốn. Cơ chế nhận diện retry (ví dụ commandId/correlationId) và cách lưu trữ trạng thái dedup là nhiệm vụ của spec triển khai.

## **1.6. Ranh giới Nguyên tử (atomic boundaries) — ghi chú kiến trúc**

Ở mức chiến lược, các thao tác quan trọng (giành/giải phóng khóa và thay đổi trạng thái aggregate liên quan) được gom vào một atomic multi-stream write để bảo đảm nguyên tử. Giới hạn thực tế về số stream, kích thước giao dịch và các tối ưu hóa là vấn đề triển khai/hiệu năng và không được cố định trong ADR.

## **1.7. Ghi chú Về Quan sát & Vận hành (observability)**

Kiến trúc yêu cầu có khả năng giám sát mức cao cho các chỉ số liên quan đến cơ chế khóa: tần suất concurrency conflicts, latency của atomic writes và tỷ lệ thành công/thất bại của takeover. Ngưỡng cảnh báo và dashboards cụ thể là phần của playbook vận hành.

Sử dụng **Guard Streams** kết hợp với **Multi-Stream Atomic Write** của **EventStoreDB** để thực thi tính duy nhất.

Chiến lược này bao gồm:

- **Guard Streams:** Thiết lập các stream phụ trợ để lưu trữ các sự kiện khóa (LockAcquiredEvent, LockReleasedEvent). **Guard Stream keys must not contain raw PII** — prefer deterministic, hashed keys instead, for example `unique-email-<hash(normalizedEmail)>` and `unique-username-<hash(username)>`. Guard Stream được sử dụng như một cơ chế **Atomic Lock**.

  Implementation notes (short): choose a deterministic canonicalization step (e.g., normalize and lowercase emails according to project rules), then derive a fixed-length hash (recommended: HMAC-SHA256 or SHA256 hex) for the guard-stream key. Using a keyed HMAC (server-side secret/pepper) prevents simple reversal/rainbow lookup attacks; manage the key securely and include rotation procedures in ops playbooks.

  **Atomic Write Modes:** Mọi thao tác liên quan đến giá trị duy nhất đều sử dụng **Multi-Stream Atomic Write** (ghi đồng thời trên nhiều stream) để đảm bảo tính nguyên tử. Có ba chế độ ghi chính:
  1.  **Initial Acquire / New Key Acquire:** Ghi `Acquired` vào **Guard Stream Mới** với **$ExpectedVersion: $NoStream** — dùng khi một giá trị (ví dụ email/username) lần đầu được giành.
  2.  **Atomic Takeover (Ghi Đè):** Ghi `Acquired` vào **Guard Stream Hiện tại** với **$ExpectedVersion: N** (phiên bản của khóa cũ) — dùng khi khóa hiện tại đã hết hạn hoặc được phép bị giành lại; thao tác này thường đi kèm với cập nhật/khóa trạng thái của Aggregate cũ trong cùng một Multi-Stream Write.
  3.  **Key Swap / Release:** Kết hợp ghi `Released` vào **Guard Stream Cũ** với **$ExpectedVersion: N** và ghi `Acquired` vào **Guard Stream Mới** (thường với **$ExpectedVersion: $NoStream**) trong cùng một Multi-Stream Atomic Write để thực hiện **Atomic Key Swap** (giải phóng khóa cũ và giành khóa mới) — xem ví dụ triển khai ở Mục 6.1 (Email) và Mục 6.2 (Username).

Việc vi phạm `$NoStream` hoặc `$ExpectedVersion: N` trên bất kỳ Guard Stream nào sẽ khiến **toàn bộ giao dịch thất bại** (Concurrency Exception), bảo vệ tính toàn vẹn của ràng buộc duy nhất.

## **3. Lý do**

Lựa chọn này được ưu tiên vì giải quyết được xung đột giữa yêu cầu **Strong Consistency** cho invariants và mô hình **Eventual Consistency** của **Read Model** trong kiến trúc CQRS/ES:

- **Giữ EventStoreDB là Source of Truth:** Bằng cách sử dụng **Guard Streams**, hệ thống tránh được sự phức tạp và rủi ro của **Distributed Transaction** với các cơ sở dữ liệu khác (như RDBMS) chỉ để kiểm tra ràng buộc duy nhất.
- **Strong Consistency tại Write-Time:** Ràng buộc duy nhất được kiểm tra và áp đặt đồng bộ ngay tại **Write Model** thông qua **Atomic Write**, loại bỏ hoàn toàn **Projector Lag Risk** và đảm bảo quyết định nghiệp vụ là chính xác.
- **Nguyên tử cho Key Swap:** Tính năng **Multi-Stream Atomic Write** của ESDB đảm bảo rằng việc giải phóng khóa cũ (ghi $Released) và giành khóa mới (ghi $Acquired) diễn ra nguyên tử. Không thể xảy ra trường hợp chỉ một phần của thao tác swap được thực hiện.
- **Tuân thủ Clean Architecture/CQRS:** **Write Model** độc lập đưa ra quyết định dựa trên **Event Stream** nội tại và trạng thái khóa trong **Guard Streams**, tuân thủ nghiêm ngặt nguyên tắc tách biệt trách nhiệm.

## **4. Hậu quả (Consequences)**

### **Tích cực**

- **Tính Toàn vẹn (Invariant Integrity) Tuyệt đối:** Việc áp dụng **Atomic Key Swap** đảm bảo rằng không bao giờ có hai Aggregate cùng chiếm giữ một giá trị duy nhất, ngay cả trong môi trường phân tán với các lệnh ghi đồng thời.
- **Đơn giản hóa Vận hành:** EventStoreDB đóng vai trò vừa là Event Store vừa là cơ chế khóa nguyên tử, giảm thiểu sự phụ thuộc vào các hệ thống khóa ngoài (Redis, Zookeeper), qua đó giảm bề bộn tích hợp và phức tạp khi **recovery**.
- **Khả năng Audit Dễ dàng:** Mọi hành vi Acquired/Released được lưu dưới dạng events, cho phép truy vết lịch sử và phân tích sau sự cố một cách chi tiết.

### **Tiêu cực / Chi phí**

- **Tăng Độ phức tạp của Command Handler:** Mỗi **Command** liên quan đến giá trị duy nhất yêu cầu một **Atomic Transaction** phức tạp hơn, đòi hỏi logic xử lý **Multi-Stream Writes** và **Concurrency Exception** chi tiết hơn, đặc biệt trong các flow như **Pending Verification**.
- **Overhead Ghi/Lưu trữ:** Mỗi thao tác liên quan đến khóa có thể tạo ra nhiều **Streams** mới và nhiều events hơn (Aggregate Stream + 2 Guard Streams cho Key Swap), làm tăng tổng lượng lưu trữ và số lượng Stream cần quản lý.
- **Phụ thuộc vào Tính năng của ESDB:** Phương án này dựa chặt chẽ vào khả năng **Multi-Stream Atomic Write** của **EventStoreDB**, gây khó khăn nếu cần **port** sang môi trường/Event Store backend khác.
- **Hiệu năng:** Multi-stream writes có thể ảnh hưởng đến **throughput** và **latency**; cần giám sát, **tuning** và chiến lược **backoff** khi tỉ lệ **Concurrency Exception** tăng cao.

## **5. Các lựa chọn đã xem xét**

Trong quá trình thiết kế, chúng tôi đã cân nhắc nhiều cách tiếp cận để đảm bảo tính duy nhất (uniqueness) cho cả tạo mới và thay đổi giá trị.

| Lựa chọn                                             | Mô tả                                                                       | Nhược điểm Chính                                                                                                                            |
| :--------------------------------------------------- | :-------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------ |
| **A. Dùng Read Model + Unique Index**                | Projector cập nhật bảng/collection có ràng buộc unique trong Read DB.       | Không đảm bảo **write-time enforcement** do **Projector Lag Risk** (Eventual Consistency).                                                  |
| **B. Dùng hệ thống khóa phân tán (Redis/Zookeeper)** | **Command Handler** lấy **external distributed lock** trước khi ghi event.  | Thêm thành phần vận hành, rủi ro **partial-failure** (lock acquired nhưng append thất bại), khó đảm bảo consistency.                        |
| **C. Centralized Unique Registry (RDBMS)**           | Ghi reservation vào RDBMS (có unique constraint) trước khi append vào ESDB. | Gây ra **Distributed Transaction** hoặc chuỗi thao tác dễ gặp **partial-failures** giữa RDBMS và ESDB.                                      |
| **D. Reservation / Pending Streams (Hai bước)**      | Sử dụng trạng thái trung gian (reserve -> confirm) thay vì atomic swap.     | Cần nhiều trạng thái trung gian, phức tạp trong bồi hoàn (**compensation**) khi có lỗi; vẫn có **window race** nếu không đảm bảo atomicity. |
| **E. Guard Streams + Atomic Write (Đề xuất)**        | Sử dụng **Multi-Stream Atomic Write** của ESDB để khóa nguyên tử.           | Tăng độ phức tạp **Command Handler** và **Overhead** Stream/Event.                                                                          |

**Kết luận:** Phương án **Guard Streams + Atomic Write** là lựa chọn duy nhất đảm bảo **Strong Consistency** và **Atomicity** cho cả tạo mới và **Key Swap** trong khi vẫn giữ **EventStoreDB** là nguồn chân thật duy nhất, phù hợp nhất với kiến trúc **Event Sourcing** đã chọn.

## **6. Chi Tiết Thực Thi: Luồng Khóa Nguyên Tử cho Email và Username**

Quy trình đăng ký người dùng mới yêu cầu đảm bảo tính duy nhất của email và username (nếu có) thông qua cơ chế **Guard Stream** và **Multi-Stream Atomic Write**, bao gồm cả luồng khởi tạo, xử lý xung đột và thay đổi (swap).

### **6.1. Chiến lược cho Email (Pending Verification và Atomic Takeover)**

Email đi kèm với thời hạn xác thực (expiresAt). Cơ chế này phải hỗ trợ **Atomic Takeover** (giành khóa nguyên tử) khi khóa cũ hết hạn nhưng chưa được xác thực.

#### **6.1.1. Luồng Đăng ký Ban đầu**

Khi Command Handler nhận RegisterUserCommand với Email X:

1. **Thao tác:** Thực hiện **Multi-Stream Atomic Write** (cùng với Username nếu có):
   - Ghi `UserRegisteredEvent` vào `iam-user-<userId>`.
   - Ghi **EmailLockAcquiredEvent** (chứa userId, expiresAt) vào Guard Stream `unique-email-<hash(normalizedEmail_X)>` với **$ExpectedVersion: $NoStream**.
2. **Thành công:** Khóa Email được giành thành công. Tiếp tục gửi email xác minh.
3. **Thất bại (Concurrency Exception):** Nếu Guard Stream `unique-email-<hash(normalizedEmail_X)>` đã tồn tại (vi phạm $NoStream), **toàn bộ giao dịch thất bại** và chuyển sang **Giai đoạn 6.1.2 (Xử lý Xung đột)**.

#### **6.1.2. Xử lý Xung đột và Atomic Takeover (Khi Concurrency Exception)**

Khi ghi khóa thất bại trên Stream Email, Command Handler phải kiểm tra trạng thái của khóa cũ để quyết định hành vi:

| Bước                                                            | Hành động                                                                                                                                                                           | Logic                                                                                                  |
| :-------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------- |
| **1. Đọc Khóa Cũ**                                              | Đọc sự kiện khóa cuối cùng (ví dụ: EmailLockAcquiredEvent) từ Guard Stream `unique-email-<hash(normalizedEmail_X)>`. Lấy ra userId_A, expiresAt_A và N (phiên bản Stream hiện tại). | Xác định người giữ khóa và thời hạn của khóa.                                                          |
| **2. Kiểm tra Hết Hạn**                                         | So sánh CurrentTime với expiresAt_A.                                                                                                                                                | Quyết định Khóa A còn hiệu lực hay đã hết hạn.                                                         |
| **Trường hợp A: Khóa CÒN HIỆU LỰC (CurrentTime < expiresAt_A)** | **Trả lỗi Nghiệp vụ** cho User mới: "Email này đang được sử dụng và chờ xác thực."                                                                                                  | Ngăn chặn việc tạo tài khoản trùng lặp và yêu cầu người dùng tiếp tục với tài khoản đang chờ xác thực. |
| **Trường hợp B: Khóa ĐÃ HẾT HẠN (CurrentTime >= expiresAt_A)**  | **Thực hiện Atomic Takeover** (Giành Khóa Nguyên tử) để giải phóng tài khoản cũ (A) và giành khóa mới (B).                                                                          | Loại bỏ tài khoản không hoạt động, giải phóng email.                                                   |

#### **6.1.3. Chi tiết Giao dịch Atomic Takeover (Nguyên tử hóa việc Giành Khóa)**

Khi Khóa Email A đã hết hạn, Command Handler của User B thực hiện **Multi-Stream Atomic Write** 3 bước. **Lưu ý:** Giao dịch này bao gồm việc vô hiệu hóa Aggregate cũ A.

| Stream                                                         | Sự kiện được Ghi                                          | $ExpectedVersion                          | Mục đích                                                                                                                        |
| :------------------------------------------------------------- | :-------------------------------------------------------- | :---------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------ |
| **1. Guard Stream** (`unique-email-<hash(normalizedEmail_X)>`) | **EmailLockAcquiredEvent** (chứa userId=B, expiresAt_new) | **N** (Version của khóa cũ A)             | **Bắt buộc:** Đảm bảo tính nguyên tử. Chỉ một giao dịch có thể ghi đè khóa bằng cách sử dụng Version chính xác (N) của khóa cũ. |
| **2. Aggregate Stream Mới** (`iam-user-<userId_B>`)            | **UserRegisteredEvent**                                   | **$NoStream**                             | Khởi tạo Aggregate mới cho User B.                                                                                              |
| **3. Aggregate Stream Cũ** (`iam-user-<userId_A>`)             | **UserAccountExpiredEvent**                               | **M** (Version cuối cùng của Aggregate A) | Vô hiệu hóa/Soft-delete tài khoản A cũ một cách nguyên tử.                                                                      |

#### **6.1.4. Xử lý Concurrency Lần 2 (Sau Atomic Takeover Thất bại)**

Nếu giao dịch **Atomic Takeover** thất bại (do Concurrency Exception trên Guard Stream `unique-email-<hash(normalizedEmail_X)>` vì $ExpectedVersion: N không khớp), điều đó có nghĩa là một tiến trình khác đã thay đổi trạng thái khóa. Command Handler của User B phải **quét lại (Re-read)** Guard Stream và quay lại logic **Giai đoạn 6.1.2** để xác định trạng thái mới nhất và trả lỗi nghiệp vụ phù hợp.

#### **6.1.5. Chi tiết Giao dịch Atomic Key Swap cho Email (Đổi Email)**

Khi Command Handler nhận ChangeEmailCommand (User U đổi Email từ X_Old (đã xác thực) sang X_New), giao dịch này phải đảm bảo tính nguyên tử cho việc giải phóng khóa cũ và giành khóa mới trong khi khởi tạo trạng thái Pending Verification cho Email mới.

**1. Điều kiện Tiên quyết (Trạng thái Aggregate):**

- Email X_Old hiện đang thuộc sở hữu và đã được xác thực bởi User U.
- Email X_New hợp lệ và khác X_Old.

2. Thao tác Khởi tạo Swap (Atomic Write):  
   Thực hiện Multi-Stream Atomic Write 3 bước:

| Stream                                                              | Sự kiện được Ghi                                          | $ExpectedVersion                    | Mục đích                                                                             |
| :------------------------------------------------------------------ | :-------------------------------------------------------- | :---------------------------------- | :----------------------------------------------------------------------------------- |
| **1. Aggregate Stream** (`iam-user-<userId_U>`)                     | **EmailChangeInitiatedEvent** (chứa X_New, expiresAt_new) | **M** (Version hiện tại của User U) | Cập nhật Aggregate: Khởi tạo trạng thái chờ xác thực cho Email mới.                  |
| **2. Guard Stream Cũ** (`unique-email-<hash(normalizedOldEmail)>`)  | **EmailLockReleasedEvent** (chứa userId=U)                | **N** (Version của khóa cũ X_Old)   | **Giải phóng khóa cũ** (X_Old). Đảm bảo khóa chưa bị giải phóng bởi tiến trình khác. |
| **3. Guard Stream Mới** (`unique-email-<hash(normalizedNewEmail)>`) | **EmailLockAcquiredEvent** (chứa userId=U, expiresAt_new) | **$NoStream**                       | **Giành khóa mới** (X_New). Đảm bảo Email X_New chưa được sử dụng bởi bất kỳ ai.     |

**3. Xử lý Thất bại:**

- **Lỗi trên Stream (3) (Guard Stream Mới):** Nếu $ExpectedVersion: $NoStream không khớp, có nghĩa là Email X_New đã được giành khóa bởi User khác (User V). **Toàn bộ giao dịch thất bại**, trả lỗi nghiệp vụ: "Email mới (X_New) đã được sử dụng hoặc đang chờ xác thực."
- Các lỗi khác (Concurrency trên Stream 1 hoặc 2) yêu cầu User U thử lại.

**4. Thao tác Xác nhận (Sau khi Xác thực Thành công):**

-- Khi Command Handler nhận ConfirmEmailChangeCommand, chỉ cần ghi `EmailChangedEvent` vào **Aggregate Stream** (`iam-user-<userId_U>`). Quá trình khóa đã được đảm bảo nguyên tử ở bước (2) nên không cần thao tác Guard Stream nào nữa.

### **6.2. Chiến lược cho Username (Khóa Vĩnh viễn)**

Username là thuộc tính duy nhất **tùy chọn** và **vĩnh viễn** (không có cơ chế expiresAt hay Pending Verification). Do đó, một khi khóa username được giành thành công, nó được coi là **khóa** vĩnh viễn cho Aggregate đó.

#### **6.2.1. Luồng Đăng ký Ban đầu**

Khi Command Handler nhận RegisterUserCommand và Username Y được cung cấp:

1. **Thao tác:** Thực hiện **Multi-Stream Atomic Write** (cùng với Email):
   - Ghi `UserRegisteredEvent` vào `iam-user-<userId>`.
   - Ghi **UsernameLockAcquiredEvent** (chứa userId) vào Guard Stream `unique-username-<hash(username_Y)>` với **$ExpectedVersion: $NoStream**.
2. **Thành công:** Username được giành khóa thành công.
3. **Thất bại (Concurrency Exception):** Nếu Guard Stream `unique-username-<hash(username_Y)>` đã tồn tại (vi phạm $NoStream), **toàn bộ giao dịch thất bại** và chuyển sang **Giai đoạn 6.2.2 (Xử lý Xung đột)**.

#### **6.2.2. Xử lý Xung đột (Khi Concurrency Exception)**

Vì Username là khóa vĩnh viễn và không có expiresAt, logic xử lý xung đột là đơn giản và không cần Atomic Takeover phức tạp.

1. **Đọc Khóa Cũ:** Đọc sự kiện khóa cuối cùng (UsernameLockAcquiredEvent) từ Guard Stream `unique-username-<hash(username_Y)>`.
2. **Kiểm tra Trạng thái:** Bất kỳ sự kiện khóa nào có mặt đều xác nhận Username đó đã được sử dụng bởi một Aggregate khác (User A).
3. **Hành động:**
   - **Trả lỗi Nghiệp vụ** (Business Error) ngay lập tức: "Tên đăng nhập (Username) này đã được sử dụng. Vui lòng chọn một tên khác."
   - **Lưu ý:** Command Handler **không** thực hiện bất kỳ hành động **Atomic Takeover** hay **Cleanup** nào.

#### **6.2.3. Chi tiết Giao dịch Atomic Key Swap cho Username (Đổi Username)**

Khi Command Handler nhận ChangeUsernameCommand (User U đổi Username từ Y_Old sang Y_New), giao dịch này phải đảm bảo tính nguyên tử cho việc giải phóng khóa cũ và giành khóa mới.

1. **Điều kiện Tiên quyết:**
   - Username Y_Old hiện đang thuộc sở hữu của User U.
   - Username Y_New phải hợp lệ (dài, ký tự).
2. **Thao tác:** Thực hiện **Multi-Stream Atomic Write** 3 bước:

| Stream                                                    | Sự kiện được Ghi                              | $ExpectedVersion                    | Mục đích                                                                              |
| :-------------------------------------------------------- | :-------------------------------------------- | :---------------------------------- | :------------------------------------------------------------------------------------ |
| **1. Aggregate Stream** (`iam-user-<userId_U>`)           | **UsernameChangedEvent** (chứa Y_New)         | **M** (Version hiện tại của User U) | Cập nhật trạng thái Aggregate User U.                                                 |
| **2. Guard Stream Cũ** (`unique-username-<hash(Y_Old)>`)  | **UsernameLockReleasedEvent** (chứa userId=U) | **N** (Version của khóa cũ Y_Old)   | Giải phóng khóa cũ. Đảm bảo khóa Y_Old chưa bị giải phóng/ghi đè bởi tiến trình khác. |
| **3. Guard Stream Mới** (`unique-username-<hash(Y_New)>`) | **UsernameLockAcquiredEvent** (chứa userId=U) | **$NoStream**                       | Giành khóa mới. Đảm bảo Username Y_New chưa được sử dụng bởi bất kỳ ai.               |

3. **Xử lý Thất bại:**
   - **Lỗi trên Stream (1) (Aggregate User U):** Nếu $ExpectedVersion: M không khớp, có nghĩa là User U đã bị thay đổi (ví dụ: đổi email, đổi username khác) đồng thời. Trả lỗi **Concurrency Exception** và User cần thử lại.
   - **Lỗi trên Stream (2) (Guard Stream Cũ):** Nếu $ExpectedVersion: N không khớp, có nghĩa là khóa cũ đã bị thay đổi/giải phóng. Trả lỗi **Concurrency Exception** và User cần thử lại.
   - **Lỗi trên Stream (3) (Guard Stream Mới):** Nếu $ExpectedVersion: $NoStream không khớp, có nghĩa là Username Y_New đã được giành khóa bởi một User khác (User V). **Toàn bộ giao dịch thất bại** (tên người dùng cũ Y_Old không bị giải phóng, tên người dùng mới Y_New không được giành), trả lỗi nghiệp vụ: "Tên đăng nhập mới (Y_New) đã được sử dụng."
