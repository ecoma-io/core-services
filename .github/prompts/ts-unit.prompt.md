---
description: Generates comprehensive unit tests for selected code using Jest, strictly following repository conventions
mode: edit
---

# Unit Test Generation Instructions

## Goal

Generate comprehensive, type-safe unit tests for the selected code using Jest, following the AAA pattern and repository conventions defined in `.github/instructions/`.

## Mandatory Instruction Files (Read First)

Before generating ANY tests, **read and apply** these instruction files:

1. **`/.github/instructions/ts.instructions.md`** — Base TypeScript rules (types, imports, async/await)
2. **`/.github/instructions/ts-jest.instructions.md`** — Jest testing conventions (AAA, mocking, assertions)

## Test Generation Checklist

### 1. File Structure & Naming

- [ ] Create test file with pattern: `<filename>.test.ts` or `<filename>.spec.ts`
- [ ] Place test file next to the source file (e.g., `user.service.ts` → `user.service.test.ts`)
- [ ] Use clear `describe` blocks: `describe('<ClassName or FunctionName>')`
- [ ] Use descriptive test names: `test('should <expected> when <condition>')`

### 2. Test Coverage Requirements

Generate tests for:

- [ ] **Happy path**: Normal execution with valid inputs
- [ ] **Error handling**: Invalid inputs, exceptions, edge cases
- [ ] **Edge cases**: Null, undefined, empty values, boundary conditions
- [ ] **Async operations**: Promise resolution and rejection
- [ ] **Side effects**: Database calls, external APIs, file I/O (mocked)

### 3. AAA Pattern (Mandatory)

Every test MUST follow this structure with clear comments:

```typescript
test('should return user when valid id provided', async (): Promise<void> => {
  // Arrange: setup variables, mocks, and dependencies
  const userId = '123';
  const expectedUser = { id: '123', name: 'John' };
  mockRepository.findById.mockResolvedValue(expectedUser);

  // Act: execute the function being tested
  const result = await userService.getUserById(userId);

  // Assert: verify the result
  expect(result).toEqual(expectedUser);
  expect(mockRepository.findById).toHaveBeenCalledWith(userId);
});
```

### 4. Type Safety & Async Handling

- [ ] Add explicit return type `Promise<void>` to async tests
- [ ] Use `async/await` for all async operations
- [ ] Use `await expect(...).resolves.toBe()` for Promise assertions
- [ ] Use `await expect(...).rejects.toThrow()` for error assertions
- [ ] Create typed mocks using `jest.Mocked<T>` or `jest.SpyInstance`

### 5. Mocking Strategy

- [ ] Mock external dependencies (databases, APIs, file system)
- [ ] Use `jest.mock()` for module-level mocks
- [ ] Use `jest.spyOn()` for method-level mocks
- [ ] Create typed mocks to avoid `any`:

```typescript
type UserRepository = { findById(id: string): Promise<User> };
const mockRepository = {
  findById: jest.fn(),
} as jest.Mocked<UserRepository>;
```

- [ ] Reset mocks in `afterEach(() => jest.resetAllMocks())`

### 6. Setup & Teardown

- [ ] Use `beforeEach` for test isolation and setup
- [ ] Use `afterEach` for cleanup and mock resets
- [ ] Use `beforeAll` / `afterAll` only for expensive setup (avoid if possible)
- [ ] Keep setup minimal and focused

### 7. Imports & Path Aliases

- [ ] Import tested code using relative imports (same directory)
- [ ] Import shared utilities using path aliases (`@ecoma-io/*`)
- [ ] Follow import order: side-effects, node built-ins, third-party, workspace aliases, local
- [ ] Import Jest types: `import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals'` (if needed)

### 8. NestJS-Specific Testing (if applicable)

For NestJS services/controllers, use `@nestjs/testing`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';

describe('UserController', () => {
  let controller: UserController;
  let service: jest.Mocked<UserService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
      providers: [
        {
          provide: UserService,
          useValue: {
            getUser: jest.fn(),
            createUser: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<UserController>(UserController);
    service = module.get(UserService) as jest.Mocked<UserService>;
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  test('should return user', async (): Promise<void> => {
    // Arrange
    const userId = '123';
    const user = { id: userId, name: 'John' };
    service.getUser.mockResolvedValue(user);

    // Act
    const result = await controller.getUser(userId);

    // Assert
    expect(result).toEqual(user);
    expect(service.getUser).toHaveBeenCalledWith(userId);
  });
});
```

### 9. Test Quality Checks

- [ ] Each test has clear, focused assertions
- [ ] Tests are independent (no shared state between tests)
- [ ] Test names describe behavior, not implementation
- [ ] Avoid testing implementation details (focus on public API)
- [ ] No hardcoded values in assertions (use constants or variables)

## Code to Test

${selection}

## Output Format

Generate tests with the following structure:

1. **File header comment**: Brief description of what's being tested
2. **Imports**: Organized by category (testing framework, code under test, mocks)
3. **Describe block**: Wrapping all related tests
4. **Setup/teardown**: `beforeEach`, `afterEach` if needed
5. **Test cases**: Grouped logically (happy path, errors, edge cases)
6. **Summary comment**: List of test scenarios covered

Example:

```typescript
/**
 * Unit tests for UserService
 */
import { Test } from '@nestjs/testing';
import { UserService } from './user.service';
import { UserRepository } from '@ecoma-io/resource-entities';

describe('UserService', () => {
  let service: UserService;
  let repository: jest.Mocked<UserRepository>;

  beforeEach(async () => {
    // Setup test module
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  // Happy path tests
  describe('getUserById', () => {
    test('should return user when valid id provided', async (): Promise<void> => {
      // Arrange, Act, Assert
    });
  });

  // Error handling tests
  describe('error handling', () => {
    test('should throw NotFoundException when user not found', async (): Promise<void> => {
      // Arrange, Act, Assert
    });
  });

  // Edge case tests
  describe('edge cases', () => {
    test('should handle empty id', async (): Promise<void> => {
      // Arrange, Act, Assert
    });
  });
});

/**
 * Test coverage:
 * - getUserById: happy path, not found, empty id
 * - createUser: success, duplicate, validation errors
 * - updateUser: success, not found, partial update
 */
```

## Validation After Generation

Run these commands to validate the generated tests:

```bash
# Run the tests
npx nx test <project>

# Run with coverage
npx nx test <project> --coverage

# Lint the test file
npx nx lint <project>
```

## Important Reminders

- **No `any` types**: Use proper typing for all mocks and variables
- **No `console.log`**: Use proper test output or remove debug logs
- **Explicit types**: Add return types to all test functions
- **Isolated tests**: Each test should work independently
- **Meaningful assertions**: Don't just test for truthy values, verify exact behavior
