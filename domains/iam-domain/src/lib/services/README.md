# Domain Services - IAM Bounded Context

## Tổng quan

Domain Services chứa business logic không thuộc về một Aggregate cụ thể hoặc cần phối hợp nhiều Aggregates. Tuân thủ nguyên tắc Hexagonal Architecture và DDD.

## Danh sách Domain Services

### 1. IUniqueValueReservationService

- **Mục đích**: Đảm bảo tính duy nhất của email trong Event Sourcing (ADR-IAM-7)
- **Kế thừa**: `IReservation<Email, string>` từ `@ecoma-io/domain`
- **Implementation**: Infrastructure layer (Postgres với UNIQUE constraint)
- **File**: `unique-value-reservation.service.ts`

### 2. IPermissionMergeService

- **Mục đích**: Hợp nhất permission trees từ 3 major versions (ADR-IAM-4)
- **Kế thừa**: None (custom interface)
- **Implementation**: Domain layer (pure function, no I/O)
- **File**: `permission-merge.service.ts`

### 3. IPermissionExpansionService

- **Mục đích**: Mở rộng permission keys bao gồm tất cả nested permissions
- **Kế thừa**: None (custom interface)
- **Implementation**: Domain layer (pure tree traversal)
- **File**: `permission-expansion.service.ts`

### 4. IPasswordHashingService

- **Mục đích**: Password hashing với Argon2id + rehash-on-login (ADR-IAM-8)
- **Kế thừa**: `IHasher` từ `@ecoma-io/domain`
- **Implementation**: Infrastructure layer (Argon2 library)
- **File**: `password-hashing.service.ts`

### 5. ISessionPolicyService

- **Mục đích**: Enforce session lifecycle policies (TTL, rate limits, revocation)
- **Kế thừa**: `IPolicy<T>` từ `@ecoma-io/domain` (optional)
- **Implementation**: Domain layer (pure policy evaluation)
- **File**: `session-policy.service.ts`

## Nguyên tắc thiết kế

### Hexagonal Architecture

- **Domain layer** (ở đây): Định nghĩa interfaces (ports)
- **Infrastructure layer** (`adapters/iam-infrastructure`): Implement interfaces với external dependencies
- **Application layer**: Orchestrate domain services với aggregates

### Pure vs Impure

- **Pure services** (PermissionMerge, PermissionExpansion, SessionPolicy):
  - Không có I/O, không có side effects
  - Implementation trong domain layer
  - Testable với mock data
- **Impure services** (UniqueValueReservation, PasswordHashing):
  - Cần external dependencies (DB, crypto libs)
  - Interface trong domain, implementation trong infrastructure
  - Integration tests trong infrastructure layer

## Cấu trúc thư mục

```
domains/iam-domain/src/lib/services/
├── index.ts                                    # Export all services
├── unique-value-reservation.service.ts         # Interface (infra impl)
├── unique-value-reservation.service.spec.ts    # Interface contract tests
├── permission-merge.service.ts                 # Interface + types
├── permission-merge.service.spec.ts            # Unit tests
├── permission-expansion.service.ts             # Interface + types
├── permission-expansion.service.spec.ts        # Unit tests
├── password-hashing.service.ts                 # Interface (extends IHasher)
├── password-hashing.service.spec.ts            # Contract tests
├── session-policy.service.ts                   # Interface + types
└── session-policy.service.spec.ts              # Unit tests
```

## Sử dụng trong Application Layer

### Example 1: User Registration với Email Reservation

```typescript
// Command Handler
class CreateUserCommandHandler {
  constructor(
    private reservationService: IUniqueValueReservationService,
    private userRepository: IUserRepository
  ) {}

  async handle(command: CreateUserCommand): Promise<void> {
    const email = Email.create(command.email);

    // 1. Reserve email
    const reservation = await this.reservationService.reserve(email, command.commandId, command.idempotencyKey);

    if (reservation.status !== 'reserved') {
      throw new EmailAlreadyInUseException();
    }

    try {
      // 2. Create aggregate and emit event
      const user = User.create({ email, ...command });
      await this.userRepository.save(user);

      // 3. Confirm reservation
      await this.reservationService.confirm(email, user.id);
    } catch (error) {
      // 4. Release on failure
      await this.reservationService.release(email);
      throw error;
    }
  }
}
```

### Example 2: Permission Check với Expansion

```typescript
// Authorization Middleware
class PermissionCheckMiddleware {
  constructor(private expansionService: IPermissionExpansionService) {}

  async checkPermission(userId: string, tenantId: string, requiredPermission: string): Promise<boolean> {
    // 1. Load user's granted permissions (from cache/DB)
    const grantedKeys = await this.loadUserPermissions(userId, tenantId);

    // 2. Load combined permission tree (from cache)
    const tree = await this.loadCombinedTree();

    // 3. Check if granted permissions cover required
    const result = this.expansionService.matches(PermissionKey.create(requiredPermission), grantedKeys, tree);

    return result.matches;
  }
}
```

### Example 3: Password Rehash on Login

```typescript
// Login Use Case
class LoginUseCase {
  constructor(
    private userRepository: IUserRepository,
    private passwordService: IPasswordHashingService
  ) {}

  async execute(email: string, password: string): Promise<AccessToken> {
    const user = await this.userRepository.findByEmail(email);

    // 1. Verify password
    const valid = await this.passwordService.verify(user.passwordHash, password);

    if (!valid) {
      throw new InvalidCredentialsException();
    }

    // 2. Check if rehash needed
    if (this.passwordService.needsRehash(user.passwordHash)) {
      // 3. Emit event for async rehash (non-blocking)
      const newHash = await this.passwordService.hash(password);
      user.upgradePasswordHash(newHash); // Emits UserPasswordUpgraded event
      await this.userRepository.save(user);
    }

    // 4. Generate token
    return this.generateToken(user);
  }
}
```

## Testing

### Unit Tests (Domain Layer)

- Test interfaces với mock implementations
- Test pure algorithms (PermissionMerge, PermissionExpansion)
- Test policy evaluation logic (SessionPolicy)

### Integration Tests (Infrastructure Layer)

- Test actual implementations với real dependencies
- Test Postgres reservation service
- Test Argon2 hashing service
- Test concurrent scenarios

### E2E Tests

- Test complete flows (registration, login, authorization)
- Test cross-service interactions

## Next Steps

1. **Implement pure domain services** (priority: medium)
   - PermissionMergeService implementation
   - PermissionExpansionService implementation
   - SessionPolicyService implementation

2. **Create infrastructure adapters** (priority: high)
   - PostgresUniqueValueReservationService
   - Argon2PasswordHashingService

3. **Write comprehensive tests**
   - Unit tests for pure services
   - Integration tests for infra services
   - E2E scenarios

4. **Update Command Handlers**
   - Integrate ReservationService into CreateUserCommand
   - Integrate PasswordHashingService into LoginUseCase

5. **Create Projector logic**
   - PermissionProjector uses MergeService and ExpansionService
   - Cache computed permissions with versioning

## References

- [ADR-IAM-4: Permission Merge Rules](../../docs/adr/ADR-IAM-4.md)
- [ADR-IAM-7: Email Uniqueness Constraints](../../docs/adr/ADR-IAM-7.md)
- [ADR-IAM-8: Password Hashing Algorithm](../../docs/adr/ADR-IAM-8.md)
- [IAM Architecture](../../docs/iam/iam-architecture.md)
