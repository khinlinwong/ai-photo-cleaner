/**
 * Feature flags for internal migration and QA.
 *
 * IMPORTANT:
 * Keep USE_SIGNAL_GROUPS_FOR_BATTLE as false until duplicate signal groups
 * have passed full QA against legacy detectDuplicates / similarGroups.
 *
 * false = legacy detectDuplicates + legacy similarGroups drive Photo Battle.
 * true  = future signal-derived groups may drive Photo Battle after QA.
 *
 * Do not enable true for production or user-facing flows yet.
 */
export const USE_SIGNAL_GROUPS_FOR_BATTLE = false;

/**
 * Experimental flag to raise native batch limit to 200.
 *
 * IMPORTANT:
 * Keep NATIVE_BATCH_LIMIT_EXPERIMENTAL_200 as false. Only set to true in
 * experimental checkpoints / branches for QA.
 */
export const NATIVE_BATCH_LIMIT_EXPERIMENTAL_200 = false;

