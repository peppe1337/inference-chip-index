/**
 * Metric registry.
 *
 * For each metric:
 *   - logKey:          exact string prefix in the log summary file
 *   - canonicalUnit:   the unit label used in output
 *   - higherIsBetter:  true if larger values are better
 *   - allowedScenarios: which canonical scenario names carry this metric
 *   - allowedWorkloads: null means all allowed workloads; otherwise an array
 *   - validityRequirement: human-readable note on what makes this value valid
 *   - perAcceleratorAllowed: whether dividing by accelerator count is meaningful
 *
 * Key findings from DATENBEFUND §Metriknamen:
 *   Offline:           "Samples per second" and "Tokens per second"
 *   Server/Interactive: "Completed samples per second", "Completed tokens per second",
 *                       and for some: "Scheduled samples per second"
 *
 * "Scheduled samples per second" != "Completed samples per second" — they must
 * not appear in the same ranking column.
 */

export type MetricId =
  | 'offline-samples-per-second'
  | 'offline-tokens-per-second'
  | 'server-completed-samples-per-second'
  | 'server-completed-tokens-per-second'
  | 'server-scheduled-samples-per-second';

export interface MetricDefinition {
  id: MetricId;
  /** Exact key prefix as it appears in the log summary (before ":"). */
  logKey: string;
  canonicalUnit: string;
  higherIsBetter: boolean;
  /** Canonical scenario names (post-alias) where this metric is valid. */
  allowedScenarios: ReadonlyArray<string>;
  /**
   * Null = all allowed workloads.  Non-null = explicit list.
   * Currently all metrics apply to all three workloads; field is here for
   * future narrowing.
   */
  allowedWorkloads: null;
  /**
   * Human-readable note on the validity requirement from the MLPerf rules.
   */
  validityRequirement: string;
  /**
   * Whether dividing this metric by the accelerator count to obtain a
   * per-accelerator figure is semantically valid.
   *
   * This is only allowed when the metric is system-level throughput and the
   * system uses homogeneous accelerators.  It is NOT allowed when
   * accelerators_per_node is 0 (those entries are quarantined anyway).
   */
  perAcceleratorAllowed: boolean;
}

export const METRIC_REGISTRY: ReadonlyArray<MetricDefinition> = [
  {
    id: 'offline-samples-per-second',
    logKey: 'Samples per second',
    canonicalUnit: 'samples/s',
    higherIsBetter: true,
    allowedScenarios: ['Offline'],
    allowedWorkloads: null,
    validityRequirement:
      'Result is VALID; min duration and min queries satisfied.',
    perAcceleratorAllowed: true,
  },
  {
    id: 'offline-tokens-per-second',
    logKey: 'Tokens per second',
    canonicalUnit: 'tokens/s',
    higherIsBetter: true,
    allowedScenarios: ['Offline'],
    allowedWorkloads: null,
    validityRequirement:
      'Result is VALID; min duration and min queries satisfied.',
    perAcceleratorAllowed: true,
  },
  {
    id: 'server-completed-samples-per-second',
    logKey: 'Completed samples per second',
    canonicalUnit: 'samples/s',
    higherIsBetter: true,
    allowedScenarios: ['Server', 'Interactive'],
    allowedWorkloads: null,
    validityRequirement:
      'Result is VALID; performance constraints, min duration, min queries, ' +
      'and early stopping satisfied.',
    perAcceleratorAllowed: true,
  },
  {
    id: 'server-completed-tokens-per-second',
    logKey: 'Completed tokens per second',
    canonicalUnit: 'tokens/s',
    higherIsBetter: true,
    allowedScenarios: ['Server', 'Interactive'],
    allowedWorkloads: null,
    validityRequirement:
      'Result is VALID; performance constraints, min duration, min queries, ' +
      'and early stopping satisfied.',
    perAcceleratorAllowed: true,
  },
  {
    id: 'server-scheduled-samples-per-second',
    // Note: the log line is "Scheduled samples per second : <value>"
    // This is semantically different from "Completed samples per second" —
    // scheduled counts queries dispatched, completed counts queries finished.
    // They must NEVER appear in the same ranking column.
    logKey: 'Scheduled samples per second',
    canonicalUnit: 'samples/s (scheduled)',
    higherIsBetter: true,
    allowedScenarios: ['Server', 'Interactive'],
    allowedWorkloads: null,
    validityRequirement:
      'Result is VALID; performance constraints, min duration, min queries, ' +
      'and early stopping satisfied.',
    perAcceleratorAllowed: true,
  },
];

/** Index by logKey for fast lookup during parsing. */
const _byLogKey = new Map<string, MetricDefinition>(
  METRIC_REGISTRY.map((m) => [m.logKey, m])
);

/** Returns the metric definition for a log key, or null if not recognised. */
export function findMetricByLogKey(logKey: string): MetricDefinition | null {
  return _byLogKey.get(logKey) ?? null;
}

/** Index by id. */
const _byId = new Map<string, MetricDefinition>(
  METRIC_REGISTRY.map((m) => [m.id, m])
);

export function findMetricById(id: MetricId): MetricDefinition | null {
  return _byId.get(id) ?? null;
}
