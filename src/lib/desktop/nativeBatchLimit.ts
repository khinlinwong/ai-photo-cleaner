import { NATIVE_BATCH_LIMIT_EXPERIMENTAL_200 } from '../config/featureFlags';

export const STABLE_NATIVE_BATCH_LIMIT = 100;
export const EXPERIMENTAL_NATIVE_BATCH_LIMIT = 200;

/**
 * Returns the effective batch limit depending on the experimental flag.
 */
export function getEffectiveNativeBatchLimit(): number {
  return NATIVE_BATCH_LIMIT_EXPERIMENTAL_200 ? EXPERIMENTAL_NATIVE_BATCH_LIMIT : STABLE_NATIVE_BATCH_LIMIT;
}

/**
 * Clamps a given batch limit between 1 and 200. Fallback to 100 for invalid values.
 */
export function clampNativeBatchLimit(limit: unknown): number {
  let parsed = NaN;
  if (typeof limit === 'number') {
    parsed = limit;
  } else if (typeof limit === 'string') {
    parsed = parseInt(limit, 10);
  }
  if (isNaN(parsed) || parsed <= 0) {
    return STABLE_NATIVE_BATCH_LIMIT;
  }
  return Math.min(Math.max(parsed, 1), EXPERIMENTAL_NATIVE_BATCH_LIMIT);
}
