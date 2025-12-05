---
description: Generates a Conventional Commit message following project-specific rules, enforcing mandatory scope, a strict 100-character limit for the subject line, correct use of blank lines, inclusion of body when subject is not enough to understand the changes, and providing a brief explanation with alternative options if applicable.
agent: agent
tools: ['runCommands/runInTerminal']
---

# Commit Message Generator

You are an expert Git commit writer. Your task is to analyze the provided code changes by utilizing the **`runCommands/runInTerminal`** tool and generate a clear, concise, and structured commit message that strictly follows the **Commit Message rules**.

## Execution flow

1.  **Acquire Context (MANDATORY):** You **MUST** call the tool **`runCommands/runInTerminal`** to execute the command **`git diff --staged`** and capture its output.
2.  **FINAL ACTION:** **IMMEDIATELY** upon receiving the output from the command in Step 1, you **MUST** analyze this context against the **Commit Message rules** and output the final commit message, a brief explanation of the choice, and alternative options if applicable.

## Commit message rules

1.  **Format:** The commit message must follow the structure: `<type>(<scope>): <description>`

2.  **Type:** The type must be one of the following **10 allowed types**:
    - **`build`**: Changes that affect the build system or external dependencies.
    - **`chore`**: Maintenance tasks, dependency updates, tooling, or other tasks that don't modify src or test files.
    - **`docs`**: Documentation only changes.
    - **`feat`**: A new feature.
    - **`fix`**: A bug fix.
    - **`perf`**: A code change that improves performance.
    - **`refactor`**: A code change that neither fixes a bug nor adds a feature.
    - **`revert`**: Reverts a previous commit.
    - **`style`**: Changes that do not affect the meaning of the code (formatting, whitespace, etc.).
    - **`test`**: Adding missing tests or correcting existing tests.
      **Note:** The `ci` type is NOT allowed. Use `chore(ci):` for CI/CD related changes instead.

3.  **Scope (MANDATORY):** A scope is required. The scope must be one of the following:
    - **`general`**: For changes that affect the entire workspace or configuration files not tied to a specific project.
    - **`deps`**: For dependency updates (package.json, pnpm-lock.yaml, etc.).
    - **`ci`**: For CI/CD configuration changes (GitHub Actions, workflows, etc.).
    - **`release`**: For version bumps, changelogs, and release-related changes.
    - **Nx Project Name**: The name of a specific Nx project (library or application), **excluding** any projects ending with `-e2e`.

## How to Choose the Correct Scope

Follow this decision tree in order:

1. **Is the change related to CI/CD or GitHub Actions workflows?**
   → Use scope **`ci`**
   - Example: `chore(ci): add Docker build caching`

2. **Is the change a dependency update (package.json, pnpm-lock.yaml)?**
   → Use scope **`deps`**
   - Example: `chore(deps): upgrade @nestjs/core to 10.3.0`

3. **Is the change a version bump, changelog, or release-related?**
   → Use scope **`release`**
   - Example: `chore(release): bump version to 1.2.0`

4. **Does the change primarily affect a specific Nx project (80%+ of changes)?**
   → Use the **exact Nx project name** from workspace
   - For apps: `idm-query`, `idm-command`,...
   - For libs: `core-product-integration-environment`,...
   - For packages: `nestjs-helpers`, `common`, `jest-helpers`,...
   - **IMPORTANT:** For E2E test changes in `e2e/idm-command-e2e/`, use the **main project name** (`idm-command`), NOT the e2e project name

5. **Does the change affect multiple projects or workspace-level configuration?**
   → Use scope **`general`**
   - Root config files: `tsconfig.base.json`, `nx.json`, `jest.preset.js`, `eslint.config.mjs`
   - Workspace scripts: `scripts/`, `.github/instructions/`, `.github/prompts/`
   - Changes spanning multiple projects equally

### Scope Examples by File Location

| Files Changed                    | Correct Scope       | Example                                             |
| -------------------------------- | ------------------- | --------------------------------------------------- |
| `apps/idm-command/src/**`        | `idm-command`       | `feat(idm-command): add user pagination`            |
| `libs/nestjs-typeorm/**`         | `nestjs-typeorm`    | `fix(nestjs-typeorm): resolve connection pool leak` |
| `packages/nestjs-exceptions/**`  | `nestjs-exceptions` | `feat(nestjs-exceptions): add BadGatewayException`  |
| `package.json`, `pnpm-lock.yaml` | `deps`              | `chore(deps): update @nestjs packages to v10`       |
| `.github/workflows/**`           | `ci`                | `chore(ci): parallelize test jobs`                  |
| `tsconfig.base.json`, `nx.json`  | `general`           | `chore(general): enable strict null checks`         |
| `e2e/resource-e2e/**`            | `idm-command`       | `test(idm-command): add user creation e2e test`     |
| `.github/instructions/**`        | `general`           | `docs(general): update TypeScript conventions`      |

### Common Scope Mistakes to Avoid

❌ **Wrong**: Using `-e2e` suffix in scope

```
test(resource-e2e): add new test cases
```

✅ **Correct**: Use the main project name

```
test(idm-command): add e2e tests for user endpoints
```

---

❌ **Wrong**: Using `ci` as commit type

```
ci(general): update workflow
```

✅ **Correct**: Use `chore(ci)`

```
chore(ci): update workflow to use Node 20
```

---

❌ **Wrong**: Omitting scope

```
feat: add user service
```

✅ **Correct**: Always include scope

```
feat(idm-command): add user service
```

---

❌ **Wrong**: Using multiple scopes

```
feat(idm-command,nestjs-typeorm): add pagination
```

✅ **Correct**: Choose the primary scope (where 80%+ changes are)

```
feat(idm-command): add cursor-based pagination
```

4.  **Description (Subject Line):** The description must be:

- **STRICT LENGTH LIMIT:** The entire subject line (including type, scope, brackets, and colon) **MUST NOT exceed 100 characters**.
- Written in the **imperative mood** (e.g., "add", "fix", "update", NOT "added", "fixes", "updating").
- Written entirely in **English**.
- **Focus on the CORE impact**: Describe the PRIMARY change, not implementation details.

- **Be concise and precise**: Remove unnecessary words while keeping meaning clear.
  - **Aim for just-enough specificity (not the shortest possible)**: If a precise term fits within the 100-character limit, prefer it (e.g., "cursor-based pagination" over the more generic "user pagination"), but avoid verbose implementation details like "using TypeORM QueryBuilder".

### How to Write Concise and Focused Descriptions

**Goal**: Describe WHAT changed and its MAIN impact in the fewest words possible.

**Remove unnecessary words:**

- ❌ "in order to" → ✅ "to"
- ❌ "make changes to" → ✅ "update" or "modify"
- ❌ "add support for" → ✅ "add" or "support"
- ❌ "fix bug where" → ✅ "fix" or "prevent"

**Focus on user/developer impact, not implementation:**

- ❌ `feat(idm-command): implement cursor-based pagination using TypeORM QueryBuilder`
- ✅ `feat(idm-command): add cursor-based pagination`

- ❌ `fix(idm-command): add null check in validation logic to prevent errors`
- ✅ `fix(idm-command): prevent null pointer in validation`

- ❌ `refactor(nestjs-typeorm): extract database connection logic into separate service class`
- ✅ `refactor(nestjs-typeorm): extract connection logic`

**Prioritize the PRIMARY change when multiple changes exist:**

- If you updated 3 files but the core change is "add cursor-based pagination",
  prefer a precise yet concise subject under 100 chars:
  - ✅ `feat(idm-command): add cursor-based pagination`
  - NOT: `feat(idm-command): update controller, service and add tests`
  - Avoid overly generic: `feat(idm-command): add pagination`

### Quick Title Picker

Compose the subject in 3 parts (keep ≤ 100 chars):

1. Verb (imperative, standardized): add | fix | refactor | optimize | test | docs | chore | remove | deprecate
2. Component/Domain: idm-command | nestjs-typeorm | nestjs-exceptions | deps | ci | general
3. Distinguishing qualifier (only if helpful and still ≤ 100): cursor-based | paginated | cached | parallel

Examples:

- `feat(idm-command): add cursor-based pagination`
- `fix(nestjs-typeorm): prevent connection leak on errors`
- `perf(idm-command): optimize user search with single join`

**Use standard verbs consistently:**

- `add` - new feature, file, or capability
- `update` - modify existing functionality
- `remove` - delete code, feature, or file
- `fix` - correct a bug or issue
- `refactor` - restructure code without changing behavior
- `improve` - enhance performance, UX, or code quality
- `support` - enable compatibility or integration

### Subject Line Examples (Good vs Bad)

| ❌ Bad (too long/vague)                                                   | ✅ Good (concise/focused)                                |
| ------------------------------------------------------------------------- | -------------------------------------------------------- |
| `feat(idm-command): add new pagination feature to user list endpoint`     | `feat(idm-command): add user pagination`                 |
| `fix(idm-command): fix the bug where null values cause errors`            | `fix(idm-command): handle null user profiles`            |
| `chore(deps): update all NestJS related packages to latest version`       | `chore(deps): update @nestjs packages to v10`            |
| `refactor(nestjs-typeorm): change the way we handle database connections` | `refactor(nestjs-typeorm): simplify connection handling` |
| `test(idm-command): add new integration test cases for user creation`     | `test(idm-command): add user creation e2e tests`         |

5.  **Body (Required if necessary):** Include a detailed body paragraph if the change is significant or complex. Body lines should wrap at 72-100 characters.

## When to Include a Body

Add a detailed body when:

✅ **Required:**

- The change affects multiple files or components
- The change requires context or explanation of "why" (not just "what")
- Breaking changes that need detailed migration guide
- Complex bug fixes that need reproduction steps or root cause explanation
- Performance improvements that need benchmarks or metrics
- Refactoring that changes internal implementation significantly

❌ **Not needed:**

- Simple one-line changes (typo fix, variable rename)
- Self-explanatory changes where subject line is sufficient
- Changes already well-documented in linked issues/PRs

## Body Content Structure

The body should answer these questions (as applicable):

1. **Why** is this change necessary?
   - What problem does it solve?
   - What was the previous behavior/limitation?

2. **How** does this change address it?
   - Brief explanation of the approach
   - Key technical decisions made

3. **What** are the impacts?
   - Breaking changes (if any)
   - Migration steps (if needed)
   - Performance implications
   - Dependencies affected

4. **Additional context** (optional):
   - Related issues: use plain references like `Fixes: issue-123` or `Relates: issue-456` (replace with real tracker IDs)
   - Benchmarks or metrics
   - Alternative approaches considered

### Body Formatting Rules

- **Line length**: Wrap at 72-100 characters per line
- **Paragraphs**: Separate logical sections with blank lines
- **Lists**: Use `-` or `*` for bullet points
- **Code**: Use backticks for technical terms, file names
- **Imperative mood**: Continue using imperative mood (consistent with subject)
- **Language**: English only

### Body Examples by Commit Type

**feat: New Feature**

```
feat(idm-command): add user pagination support

Implement cursor-based pagination for user listing endpoints to
improve performance with large datasets. Previous offset-based
pagination caused slow queries on tables with millions of rows.

Changes:
- Add PaginationDto with cursor and limit fields
- Implement CursorPaginationService using TypeORM query builder
- Update UserController.list() to accept pagination params

Performance: Reduced query time from 2.5s to 120ms on 1M records.
```

**fix: Bug Fix**

```
fix(nestjs-typeorm): resolve connection pool exhaustion

Fix memory leak where database connections were not properly released
after query failures. This caused the pool to be exhausted after ~100
failed queries, requiring service restart.

Root cause: Error handler was catching exceptions but not calling
queryRunner.release() in the finally block.

Solution: Wrap all query operations in try-finally blocks to ensure
cleanup happens even on errors.

Fixes: issue-234
```

**perf: Performance Improvement**

```
perf(idm-command): optimize user search query

Replace multiple N+1 queries with a single JOIN query using TypeORM's
query builder. Previous implementation ran 1 + N queries for N users.

Benchmark (1000 users):
- Before: 1847ms (1001 queries)
- After: 156ms (1 query)

Trade-off: Slightly more complex query logic, but 10x faster.
```

**BREAKING CHANGE Example**

```
feat(nestjs-exceptions): standardize error response format

BREAKING CHANGE: Error responses now return statusCode instead of code

Previous format:
{
  "code": 404,
  "message": "Not found"
}

New format:
{
  "statusCode": 404,
  "message": "Not found",
  "error": "NotFoundException"
}

Migration:
- Update frontend code to read statusCode instead of code
- The error field now contains the exception class name
- Custom error metadata is now under details field
```

6.  **BLANK LINE (Body):** If a Body exists (Rule 5), there **MUST BE EXACTLY ONE BLANK LINE** separating the Subject Line (Rule 4) and the Body.

7.  **Breaking Changes (Footer):** To denote a Breaking Change, you must add a dedicated footer section starting with **`BREAKING CHANGE: `** followed by a detailed description. If a Footer is present, there **MUST BE EXACTLY ONE BLANK LINE** separating the Body (or Subject Line if Body is empty) and the Footer.

## Scope Validation Checklist

Before finalizing the commit message, verify:

- [ ] Scope is one of: `general`, `deps`, `ci`, `release`, or exact Nx project name
- [ ] For project names: verified it exists in workspace (not using arbitrary names)
- [ ] NOT using `-e2e` suffix (use main project name instead)
- [ ] NOT using multiple scopes (chose the most relevant one based on 80%+ rule)
- [ ] Scope matches the primary area of change

## Subject Line Validation Checklist

Before finalizing the subject line, verify:

- [ ] Total length ≤ 100 characters (including type, scope, and description)
- [ ] Uses imperative mood ("add" not "added", "fix" not "fixes")
- [ ] Focuses on CORE impact, not implementation details
- [ ] Removes unnecessary words while keeping meaning clear
- [ ] Describes the PRIMARY change when multiple changes exist
- [ ] Written in English

## OUTPUT BEHAVIOR

If the tool call successfully runs and returns context, your output must include:

- The final, compliant commit message.
- A brief explanation of why this commit message was chosen.
- If applicable, provide 2-3 alternative title message options.

---

**(Do NOT output anything below this line unless it is the final output including commit message, explanation, and alternatives after the tool execution.)**
