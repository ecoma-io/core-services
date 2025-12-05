import { Level } from 'pino';

/**
 * Determine whether the provided parameter appears to be an error stack trace
 * for an error logging call (used to detect the non-standard exception handler
 * contract where `.error(message, stack)` is passed).
 *
 * @param message - The message being logged (should be a string)
 * @param level - The pino log level for the call
 * @param param - Candidate param that might be a stack trace string
 * @returns True when the param looks like a stack trace for the given level
 */
export function isStackTrace(
  message: unknown,
  level: Level,
  param: unknown
): boolean {
  return (
    typeof message === 'string' &&
    typeof param === 'string' &&
    level === 'error' &&
    /\n\s*at /.test(param)
  );
}
