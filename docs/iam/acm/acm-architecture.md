# Kiến trúc ACM (Access Management)

## 1. Giới thiệu & Phạm vi

ACM là sub-bounded context thuộc hệ IAM, chịu trách nhiệm quản lý vòng đời phiên đăng nhập (session), token truy cập (access/refresh token), kiểm soát thu hồi (revocation), và các cơ chế xác thực truy cập. ACM là authority cho việc phát hành, xác thực, thu hồi token và quản lý session.

## 2. Mục tiêu & Động lực

- Quản lý session, token, revocation một cách bảo mật, hiệu quả, mở rộng.
- Hỗ trợ các cơ chế xác thực hiện đại: JWT, Opaque Token, Token Rotation, Revoke Token Family.
- Đảm bảo khả năng thu hồi tức thì (instant revocation) và kiểm soát truy cập tập trung.

## 3. Sơ đồ quan hệ ACM với các Bounded Context và Service khác

```mermaid
flowchart LR

	subgraph IAM["IAM (Identity and Access Management)"]
		IDM["IDM (Identity Management)"]
		ACM["ACM (Access Management)"]
		AZM["AZM (Authorization Management)"]
		OCS["OCS (Org & Context Scoping)"]
	end

  subgraph External_Services["External Services"]
    API_Gateway["API Gateway / Reverse Proxy"]
    ClientApp["Client Applications"]
    ServiceA["Service A"]
    ServiceB["Service B"]
  end

	API_Gateway -->|"AuthN/AuthZ, Token, Introspection"| ACM
	ClientApp -->|"Login, Token, Logout"| ACM
	ServiceA -->|"Token Introspection"| ACM
	ServiceB -->|"Token Introspection"| ACM

	ACM -- "Event (Session, Token, Revocation)" --> IDM
	ACM -- "Event (Session, Token, Revocation)" --> AZM
	ACM -- "Event (Session, Token, Revocation)" --> OCS
	IDM -- "User/Identity Event" --> ACM
	AZM -- "Permission/Role Event" --> ACM
	OCS -- "Context/Mapping Event" --> ACM

	ACM <--> |"RabbitMQ/Event Bus"| IDM
	ACM <--> |"RabbitMQ/Event Bus"| AZM
	ACM <--> |"RabbitMQ/Event Bus"| OCS
```

## 3. Các yêu cầu chức năng và phi chức năng

### 3.1. Yêu cầu chức năng

- [Session Creation (Login)](./acm-use-cases.md#session-creation-login)
- [Refresh Token Rotation & Refresh](./acm-use-cases.md#token-refresh-and-rotation)
- [Logout and Session Revocation](./acm-use-cases.md#logout-and-session-revocation)
- [Family (fid) Revocation](./acm-use-cases.md#revocation-by-fid-family-invalidation)
- [Token Validation / Introspection](./acm-use-cases.md#token-validation--introspection)
- [Revocation Orchestration (Trigger Handling)](./acm-use-cases.md#handling-triggers-from-idmazmocs-revocation-orchestration)
- [OAuth Client Lifecycle](./acm-use-cases.md#oauth-client-management)
- [Token Revocation (RFC7009)](./acm-use-cases.md#token-revocation-rfc-7009)
- [Session Management](./acm-use-cases.md#session-management-list--get--revoke)
- [Client Credentials and Service Tokens](./acm-use-cases.md#client-credentials--service-tokens)
- [MFA Enforcement & Step-up](./acm-use-cases.md#mfa--step-up-authentication-acm-side)
- [Token Introspection](./acm-use-cases.md#introspection-endpoint-rfc-7662-like)
- [Refresh Token Lifecycle Clarifications](./acm-use-cases.md#clarify-refresh-token-lifecycle-and-reuse-handling)

### 3.2. Yêu cầu phi chức năng

**Yêu cầu phi chức năng (SLO/SLI):**

- **SLO về tính sẵn sàng:** Đảm bảo 99,95% thời gian hoạt động hàng tháng cho các endpoint phát hành và xác thực token.
- **SLI về độ trễ:** 95% các yêu cầu xác thực/introspection token hoàn thành trong vòng 100ms. _(Đo từ lúc server nhận request đến khi gửi response, chỉ tính thời gian phía server, không bao gồm thời gian mạng của client.)_
- **SLI về tính nhất quán:** 99% sự kiện thu hồi session/token được phản ánh lên read model trong vòng 2 giây.
- **SLO về bảo mật:** 100% token được phát hành bằng thuật toán an toàn (ví dụ: RS256/JWT, Opaque) và không lưu trữ secret thô trong event/projection.
- **SLO về khả năng mở rộng:** Hỗ trợ tối thiểu 1000 thao tác đăng nhập/phiên đồng thời với tỷ lệ lỗi < 1%.
- **SLO về khả năng kiểm toán:** 100% sự kiện vòng đời session/token được ghi log và truy vết đầy đủ.

## 4. Context Map

```mermaid
flowchart LR

	subgraph IAM["IAM (Identity and Access Management)"]
		IDM["IDM (Identity Management)"]
		ACM["ACM (Access Management)"]
		AZM["AZM (Authorization Management)"]
		OCS["OCS (Org & Context Scoping)"]
	end

  subgraph External_Services["External Services"]
    API_Gateway["API Gateway / Reverse Proxy"]
    ClientApp["Client Applications"]
    ServiceA["Service A"]
    ServiceB["Service B"]
  end

	API_Gateway -->|"AuthN/AuthZ, Token, Introspection"| ACM
	ClientApp -->|"Login, Token, Logout"| ACM
	ServiceA -->|"Token Introspection"| ACM
	ServiceB -->|"Token Introspection"| ACM

	ACM -- "Event (Session, Token, Revocation)" --> IDM
	ACM -- "Event (Session, Token, Revocation)" --> AZM
	ACM -- "Event (Session, Token, Revocation)" --> OCS
	IDM -- "User/Identity Event" --> ACM
	AZM -- "Permission/Role Event" --> ACM
	OCS -- "Context/Mapping Event" --> ACM

	ACM <--> |"RabbitMQ/Event Bus"| IDM
	ACM <--> |"RabbitMQ/Event Bus"| AZM
	ACM <--> |"RabbitMQ/Event Bus"| OCS
```

## 5. Sơ đồ triển khai

```mermaid
flowchart TD
	subgraph ACM_Command_Service["ACM Command Service"]
		ACM_Command["acm-command"]
	end

	subgraph EventStoreDB["Event Store DB"]
		EventStore[("EventStoreDB")]
	end

	subgraph ACM_Projector_Service["ACM Projector Service"]
		ACM_Projector["acm-projector"]
	end

	subgraph Read_Models["Read Models"]
		PostgreSQL[("PostgreSQL")]
		Redis[("Redis (Projection/Cache)")]
		Elasticsearch[("Elasticsearch")]
	end

	subgraph ACM_Query_Service["ACM Query Service"]
		ACM_Query["acm-query"]
	end

	subgraph MessageBus["Message Bus"]
		RabbitMQ[("RabbitMQ")]
	end

	subgraph Auth_Service["ACM Auth Service"]
		ACM_Auth["acm-auth-service"]
		Redis_Blacklist[("Redis (Blacklist)")]
	end

	%% Luồng dữ liệu nội bộ ACM
	ACM_Command -->|"Append Event"| EventStore
	EventStore -->|"Consume Event"| ACM_Projector
	ACM_Projector -->|"Build/Update"| PostgreSQL
	ACM_Projector -->|"Cache/Index"| Redis
	ACM_Projector -->|"Indexing"| Elasticsearch
	ACM_Projector -->|"Publish Event"| RabbitMQ
	ACM_Query -->|"Query"| PostgreSQL
	ACM_Query -->|"Query (cache)"| Redis
	ACM_Query -->|"Query (search)"| Elasticsearch

	%% Auth Service chuyên biệt
	ACM_Auth -->|"Check Token/Session"| Redis_Blacklist
	ACM_Auth -->|"Query"| PostgreSQL
	ACM_Auth -->|"Query (cache)"| Redis
	ACM_Projector -->|"Sync Blacklist"| Redis_Blacklist
```

## 6. Các tài liệu tham khảo

- [ACM Domain Model](./acm-domain-model.md)
- [ACM Use Cases](./acm-use-cases.md)
- [ACM Roadmap](./acm-roadmap.md)
