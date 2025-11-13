# nestjs-typeorm

Shared helpers and base classes for TypeORM entities used across services.

This library provides small, reusable abstract entity base classes that map to TypeORM decorators and align with the project's shared entity interfaces:

- `BaseEntity` — supplies `createdAt` via `@CreateDateColumn()`
- `BaseTimestampedEntity` — extends `BaseEntity` and adds `updatedAt` via `@UpdateDateColumn()`
- `BaseSoftDeleteEntity` / `BaseSoftDeleteTimestampedEntity` — adds a nullable `deletedAt` column for soft deletes and (optionally) `updatedAt`

## Quick usage

Extend the base classes in your entity definitions to inherit the common timestamp and soft-delete columns. Example:

```ts
import { Entity as OrmEntity, PrimaryGeneratedColumn } from 'typeorm';
import { BaseTimestampedEntity } from '@ecoma-io/nestjs-typeorm';

@OrmEntity({ name: 'my_table' })
export class MyEntity extends BaseTimestampedEntity<number> {
  @PrimaryGeneratedColumn()
  id!: number;

  // add domain-specific columns below
}
```

Notes:

- Use the project's path aliases for imports (e.g. `@ecoma-io/nestjs-typeorm`).
- The `createdAt` and `updatedAt` columns are managed by TypeORM via `@CreateDateColumn()` and `@UpdateDateColumn()` by default. Behavior (whether `updatedAt` is set on insert) depends on the database driver and TypeORM version — see "Timestamps" below.

## API Reference

### BaseEntity<TID>

Abstract base class providing a `createdAt` timestamp.

- **Generic Parameter**: `TID` - The type of the entity's ID (extends `ID` or `undefined`).
- **Properties**:
  - `createdAt: Date` - Automatically set on entity creation.

### BaseTimestampedEntity<TID>

Extends `BaseEntity` and adds an `updatedAt` timestamp.

- **Generic Parameter**: `TID` - The type of the entity's ID.
- **Properties**:
  - Inherits `createdAt` from `BaseEntity`.
  - `updatedAt: Date` - Automatically set on entity update.

### BaseSoftDeleteEntity<TID>

Extends `BaseEntity` and adds a nullable `deletedAt` for soft deletes.

- **Generic Parameter**: `TID` - The type of the entity's ID.
- **Properties**:
  - Inherits `createdAt` from `BaseEntity`.
  - `deletedAt: Date | null` - Set when the entity is soft deleted.

### BaseSoftDeleteTimestampedEntity<TID>

Combines soft delete with timestamp tracking.

- **Generic Parameter**: `TID` - The type of the entity's ID.
- **Properties**:
  - Inherits `createdAt` from `BaseEntity`.
  - `updatedAt: Date` - Automatically set on entity update.
  - `deletedAt: Date | null` - Set when the entity is soft deleted.

## Timestamps and soft deletes

- `createdAt` (`@CreateDateColumn()`): set automatically on insert.
- `updatedAt` (`@UpdateDateColumn()`): set automatically on update; some drivers/setups also set it on insert. If your code assumes `updatedAt` is always present immediately after insert, add tests or configure a DB default (e.g. `default: () => 'now()'`) or change the type to allow `null`.
- `deletedAt`: a nullable column used for soft delete semantics (when non-null the entity is considered deleted). Queries should use `WHERE deletedAt IS NULL` to filter active rows.

## Testing

Unit tests are written using Jest and follow the Arrange-Act-Assert (AAA) pattern. Tests verify TypeORM metadata configuration for the base entities.

Run tests with:

```bash
npx nx test nestjs-typeorm
```

## Build

Build the library with Nx:

```bash
npx nx build nestjs-typeorm
```

## Lint

If you want to run linting for this lib (workspace must have the appropriate target):

```bash
npx nx lint nestjs-typeorm
```

## Contributing

- Add unit tests for any behavior you change here.
- Follow the repository's conventional commits and formatting rules.

## Where to look next

- Shared entity interfaces: `packages/common/src/lib/entities` (Entity, TimestampedEntity, SoftDeleteEntity)
- TypeORM column mappings: `libs/nestjs-typeorm/src/lib/*-entity.ts`
