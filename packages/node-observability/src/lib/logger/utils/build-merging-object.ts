/**
 * Build the merging object used by the logger for structured logs.
 *
 * @param instanceExtra - Optional instance-level extra keys to include in every log
 * @param context - Context extracted (or passed) for this log entry
 * @param additionalProps - Additional properties to merge into the result (e.g. message props)
 * @returns A new object ready to be passed as the merging object for pino
 */
export function buildMergingObject(
  instanceExtra: Record<string, unknown> | undefined,
  context: unknown,
  additionalProps: Record<string, unknown> = {}
): Record<string, unknown> {
  const mergingObject: Record<string, unknown> = {};

  if (instanceExtra) {
    Object.assign(mergingObject, instanceExtra);
  }

  Object.assign(mergingObject, additionalProps);
  mergingObject['context'] = context;

  return mergingObject;
}
