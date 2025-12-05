import { Level } from 'pino';
import { isObject } from '@ecoma-io/common';
import { last } from './last';
import { isInterpolated } from './is-interpolated';

/**
 * Analyze optional params passed to the logger and extract context, interpolation values
 * and an optional merging object.
 *
 * @param message - The primary message passed to the logger (string, Error, object, etc.)
 * @param level - The pino log level currently being used
 * @param optionalParams - The trailing optional parameters passed to the logger call
 * @param instanceContext - Optional instance-level context fallback when no context is present in params
 * @returns An object containing the resolved context, interpolation values, the merge object and a copy of params without the context
 * @remarks This helper is responsible for reproducing the (message, ...params) analysis used by the
 * StandardizedLogger so that the public logging surface can interpret arguments consistently.
 */
export function analyzeParams(
  message: unknown,
  level: Level,
  optionalParams: unknown[],
  instanceContext?: unknown
): {
  context: unknown;
  interpolationValues: unknown[];
  mergeObject: Record<string, unknown>;
  paramsWithoutContext: unknown[];
} {
  const maybeLast = last(optionalParams);
  const lastLooksLikeStackTrace =
    typeof message === 'string' &&
    typeof maybeLast === 'string' &&
    level === 'error' &&
    /\n\s*at /.test(maybeLast);

  let context: unknown;
  let paramsWithoutContext: unknown[];

  if (maybeLast !== undefined && !lastLooksLikeStackTrace) {
    context = maybeLast;
    paramsWithoutContext = optionalParams.slice(0, -1);
  } else {
    context = instanceContext;
    paramsWithoutContext = optionalParams;
  }

  const maybeMergeObject = last(paramsWithoutContext);
  const mergeObject: Record<string, unknown> = {};
  let interpolationValues: unknown[];

  if (
    isObject(maybeMergeObject) &&
    !isInterpolated(message, paramsWithoutContext.length - 1)
  ) {
    interpolationValues = paramsWithoutContext.slice(0, -1);
    Object.assign(mergeObject, maybeMergeObject);
  } else {
    interpolationValues = paramsWithoutContext;
  }

  return { context, interpolationValues, mergeObject, paramsWithoutContext };
}
