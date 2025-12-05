import { isObject } from '@ecoma-io/common';
import { redactObject } from './redact-object';

/**
 * Redact given value using redactKeys when value is an object.
 */
export function redactIfNeeded<T>(value: T, redactKeys: readonly string[]): T {
  if (redactKeys.length > 0 && isObject(value)) {
    return redactObject(
      value as unknown as Record<string, unknown>,
      redactKeys as string[]
    ) as unknown as T;
  }
  return value;
}
