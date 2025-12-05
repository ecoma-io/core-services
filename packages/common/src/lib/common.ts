// Utility Types
export type Primitive =
  | string
  | number
  | boolean
  | bigint
  | symbol
  | null
  | undefined;
export type Nullable<T> = T | null;
export type Optional<T> = T | undefined;
export type NullableOptional<T> = T | null | undefined;
export type Dict<TValue, TKey extends string | number | symbol = string> = {
  [key in TKey]: TValue;
};

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type DeepRequired<T> = {
  [P in keyof T]-?: T[P] extends object ? DeepRequired<T[P]> : T[P];
};

export type NonNullable<T> = T extends null | undefined ? never : T;

export type KeysOfType<T, U> = {
  [K in keyof T]: T[K] extends U ? K : never;
}[keyof T];

export type PickByType<T, U> = Pick<T, KeysOfType<T, U>>;

// Function Types
export type AsyncFunction<
  TArgs extends unknown[] = unknown[],
  TReturn = unknown,
> = (...args: TArgs) => Promise<TReturn>;

export type MaybeAsync<T> = T | Promise<T>;

// Common Generic Types
export type OptionalFields<T, K extends keyof T> = Omit<T, K> &
  Partial<Pick<T, K>>;
export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;
export type ReadonlyFields<T, K extends keyof T> = Omit<T, K> &
  Readonly<Pick<T, K>>;

export type ReadonlyArrray<T> = readonly T[];

// Extract types
export type ExtractArrayType<T> = T extends (infer U)[] ? U : never;
export type ExtractPromiseType<T> = T extends Promise<infer U> ? U : never;

export type ID = string | number;
