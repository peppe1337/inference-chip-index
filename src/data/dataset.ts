/**
 * The single source of truth for published data.
 *
 * Everything here is derived from `pipeline-output/full-snapshot.json`, which is
 * produced by the update pipeline from the pinned upstream commit. Nothing in this
 * file invents a value: every number traces back to an MLPerf Inference v6.0
 * `mlperf_log_summary.txt` with a recorded SHA-256.
 *
 * Design rules that the task specification makes non-negotiable:
 *  - A ranking only ever compares one exact slice (release + division + workload +
 *    scenario + metric + unit). We never rank across slices.
 *  - Accelerator counts come from `accelerators_per_node * number_of_nodes` in the
 *    system description, NEVER from strings in the accelerator name such as "x8",
 *    "Dual" or "NVL72". Records whose count is not determinable are quarantined by
 *    the pipeline and cannot appear in a ranking or a derived metric.
 *  - Derived (per-accelerator) values are only computed when the metric registry
 *    allows derivation AND the accelerator count is known.
 */

import snapshot from '../../pipeline-output/full-snapshot.json';
import { METRIC_REGISTRY as PIPELINE_METRIC_REGISTRY } from '../pipeline/metric-registry';

export const RELEASE = 'v6.0' as const;
export const DIVISION = 'closed' as const;

export type SourceRef = {
  repository: string;
  commit: string;
  path: string;
  url: string;
  sha256: string;
};

export type SnapshotMetric = { metricId: string; logKey: string; unit: string; value: number };

export type SnapshotRecord = {
  logicalId: string;
  contentId: string;
  submitter: string;
  systemId: string;
  workload: string;
  scenario: string;
  scenarioInLog: string;
  scenarioMismatch: boolean;
  acceleratorName: string;
  acceleratorNameRaw: string;
  acceleratorCount: number | null;
  acceleratorsPerNodeRaw: string | null;
  numberOfNodesRaw: string | null;
  reviewRequired: boolean;
  quarantineReasons: string[];
  metrics: SnapshotMetric[];
  logSource: SourceRef;
  systemSource: SourceRef;
};

type Snapshot = {
  schemaVersion: string;
  mode: string;
  sourceCommit: string;
  recordsHash: string;
  counts: { total: number; released: number; quarantined: number; scenarioMismatches: number };
  records: SnapshotRecord[];
  quarantine: Array<Omit<SnapshotRecord, 'metrics'> & { metrics?: SnapshotMetric[] }>;
  scenarioMismatches: Array<{
    logicalId: string;
    submitter: string;
    systemId: string;
    workload: string;
    scenarioFromPath: string;
    scenarioInLog: string;
    note: string;
  }>;
};

const SNAPSHOT = snapshot as unknown as Snapshot;

/* ------------------------------------------------------------------ *
 * Chip vendor and accelerator family
 * ------------------------------------------------------------------ */

/**
 * The chip vendor, resolved from the accelerator model name recorded upstream.
 *
 * This is deliberately a small, explicit allowlist rather than a loose regex: an
 * unrecognised name must surface as `unknown` so it can be reviewed, not be
 * silently bucketed into a vendor and then counted as cross-vendor evidence.
 */
export function vendorOf(acceleratorName: string): 'NVIDIA' | 'AMD' | 'Intel' | 'unknown' {
  const n = acceleratorName.toLowerCase();
  if (n.includes('nvidia')) return 'NVIDIA';
  if (n.includes('amd') || n.includes('instinct')) return 'AMD';
  if (n.includes('intel') || n.includes('arc pro')) return 'Intel';
  return 'unknown';
}

/**
 * The accelerator family. We treat the upstream model name as the family
 * identity, because any finer split (memory size, board form) is not reliably
 * encoded in v6.0 system descriptions and inferring it would be a fabrication.
 */
export function familyOf(acceleratorName: string): string {
  return acceleratorName;
}

export function slugOf(acceleratorName: string): string {
  return acceleratorName
    .toLowerCase()
    .replace(/\(r\)/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/* ------------------------------------------------------------------ *
 * Metric registry
 * ------------------------------------------------------------------ */

export type MetricDef = {
  metricId: string;
  label: string;
  unit: string;
  /** Winning direction for a ranking. All v6.0 throughput metrics are higher-is-better. */
  direction: 'higher-is-better';
  logKey: string;
  allowedScenarios: string[];
  /** Whether a per-accelerator value may be derived by dividing by the accelerator count. */
  derivationAllowed: boolean;
};

/**
 * Human-readable labels. Everything else about a metric — canonical unit,
 * direction, log key, allowed scenarios, derivability — is taken from the
 * pipeline's metric registry so the two can never drift apart.
 *
 * An earlier version restated the unit here and silently disagreed with the
 * pipeline: `server-scheduled-samples-per-second` was published as `samples/s`
 * at slice level while its rows carried `samples/s (scheduled)`. That is exactly
 * the incompatible-unit merge the specification forbids, so the duplicate is gone.
 */
const METRIC_LABELS: Record<string, string> = {
  'offline-samples-per-second': 'Offline throughput (samples)',
  'offline-tokens-per-second': 'Offline throughput (tokens)',
  'server-completed-tokens-per-second': 'Completed tokens per second',
  'server-completed-samples-per-second': 'Completed samples per second',
  'server-scheduled-samples-per-second': 'Scheduled samples per second',
};

export const METRIC_REGISTRY: Record<string, MetricDef> = Object.fromEntries(
  PIPELINE_METRIC_REGISTRY.map((m) => [
    m.id,
    {
      metricId: m.id,
      label: METRIC_LABELS[m.id] ?? m.id,
      unit: m.canonicalUnit,
      direction: 'higher-is-better' as const,
      logKey: m.logKey,
      allowedScenarios: [...m.allowedScenarios],
      derivationAllowed: m.perAcceleratorAllowed,
    },
  ])
);

/* ------------------------------------------------------------------ *
 * Slices
 * ------------------------------------------------------------------ */

export type Slice = {
  sliceId: string;
  release: string;
  division: string;
  workload: string;
  scenario: string;
  metricId: string;
  unit: string;
  direction: 'higher-is-better';
  /**
   * MLPerf v6.0 encodes the accuracy target in the workload name for the
   * workloads in scope (there is no separate 99/99.9 split for these three).
   * The source carries no separate field, so we record null rather than invent
   * a value. See DATA_SOURCES.md.
   */
  accuracyTarget: null;
  resultCount: number;
  vendorCount: number;
  familyCount: number;
  /** True when the slice has >= 3 results from >= 2 chip vendors and >= 2 families. */
  comparable: boolean;
};

export function makeSliceId(workload: string, scenario: string, metricId: string): string {
  return `${RELEASE}|${DIVISION}|${workload}|${scenario.toLowerCase()}|${metricId}`;
}

export type Row = {
  logicalId: string;
  contentId: string;
  sliceId: string;
  submitter: string;
  systemId: string;
  acceleratorName: string;
  acceleratorSlug: string;
  vendor: string;
  family: string;
  acceleratorCount: number | null;
  /** The official value exactly as logged upstream. */
  value: number;
  unit: string;
  /** value / acceleratorCount, or null when derivation is not allowed or count unknown. */
  derivedPerAccelerator: number | null;
  scenarioMismatch: boolean;
  logSource: SourceRef;
  systemSource: SourceRef;
};

function buildRows(): Row[] {
  const rows: Row[] = [];
  for (const r of SNAPSHOT.records) {
    // Quarantined records never reach a ranking. The pipeline already separates
    // them, but we fail closed here too rather than trusting one layer.
    if (r.reviewRequired || r.quarantineReasons.length > 0) continue;
    for (const m of r.metrics) {
      const def = METRIC_REGISTRY[m.metricId];
      if (!def) continue; // unknown unit/metric must not be published
      const derivable = def.derivationAllowed && typeof r.acceleratorCount === 'number' && r.acceleratorCount > 0;
      rows.push({
        logicalId: r.logicalId,
        contentId: r.contentId,
        sliceId: makeSliceId(r.workload, r.scenario, m.metricId),
        submitter: r.submitter,
        systemId: r.systemId,
        acceleratorName: r.acceleratorName,
        acceleratorSlug: slugOf(r.acceleratorName),
        vendor: vendorOf(r.acceleratorName),
        family: familyOf(r.acceleratorName),
        acceleratorCount: r.acceleratorCount,
        value: m.value,
        unit: m.unit,
        derivedPerAccelerator: derivable ? m.value / (r.acceleratorCount as number) : null,
        scenarioMismatch: r.scenarioMismatch,
        logSource: r.logSource,
        systemSource: r.systemSource,
      });
    }
  }
  return rows;
}

export const ROWS: Row[] = buildRows();

function buildSlices(): Slice[] {
  const byId = new Map<string, Row[]>();
  for (const row of ROWS) {
    const list = byId.get(row.sliceId);
    if (list) list.push(row);
    else byId.set(row.sliceId, [row]);
  }
  const slices: Slice[] = [];
  for (const [sliceId, rows] of byId) {
    const parts = sliceId.split('|');
    const workload = parts[2]!;
    const scenario = parts[3]!;
    const metricId = parts[4]!;
    const def = METRIC_REGISTRY[metricId]!;
    const vendors = new Set(rows.map((r) => r.vendor).filter((v) => v !== 'unknown'));
    const families = new Set(rows.map((r) => r.family));
    slices.push({
      sliceId,
      release: RELEASE,
      division: DIVISION,
      workload,
      scenario,
      metricId,
      unit: def.unit,
      direction: def.direction,
      accuracyTarget: null,
      resultCount: rows.length,
      vendorCount: vendors.size,
      familyCount: families.size,
      comparable: rows.length >= 3 && vendors.size >= 2 && families.size >= 2,
    });
  }
  // Deterministic order: most evidence first, then by ID so output never varies.
  slices.sort((a, b) => b.resultCount - a.resultCount || a.sliceId.localeCompare(b.sliceId));
  return slices;
}

export const SLICES: Slice[] = buildSlices();

export function getSlice(sliceId: string): Slice | undefined {
  return SLICES.find((s) => s.sliceId === sliceId);
}

export function rowsForSlice(sliceId: string): Row[] {
  return ROWS.filter((r) => r.sliceId === sliceId);
}

/* ------------------------------------------------------------------ *
 * Ranking
 * ------------------------------------------------------------------ */

export type RankedRow = Row & { rank: number };

/**
 * Ranks one exact slice. Ties share a rank (competition ranking) and are ordered
 * by logical ID so that repeated calls return byte-identical output.
 */
export function rankSlice(
  sliceId: string,
  opts: { vendors?: string[]; view?: 'official' | 'derived' } = {}
): RankedRow[] {
  const view = opts.view ?? 'official';
  let rows = rowsForSlice(sliceId);
  if (opts.vendors && opts.vendors.length > 0) {
    const want = new Set(opts.vendors.map((v) => v.toLowerCase()));
    rows = rows.filter((r) => want.has(r.vendor.toLowerCase()));
  }
  if (view === 'derived') {
    // A derived view must not silently fall back to the official number.
    rows = rows.filter((r) => r.derivedPerAccelerator !== null);
  }
  const keyOf = (r: Row) => (view === 'derived' ? (r.derivedPerAccelerator as number) : r.value);
  const sorted = [...rows].sort((a, b) => keyOf(b) - keyOf(a) || a.logicalId.localeCompare(b.logicalId));

  const ranked: RankedRow[] = [];
  let lastValue: number | null = null;
  let lastRank = 0;
  sorted.forEach((r, i) => {
    const v = keyOf(r);
    const rank = lastValue !== null && v === lastValue ? lastRank : i + 1;
    lastValue = v;
    lastRank = rank;
    ranked.push({ ...r, rank });
  });
  return ranked;
}

/* ------------------------------------------------------------------ *
 * Manifest
 * ------------------------------------------------------------------ */

export const DATASET_MANIFEST = {
  name: 'Inference Chip Index',
  description:
    'Normalized MLPerf Inference v6.0 closed-division results for AI inference accelerators, with per-record provenance.',
  schemaVersion: SNAPSHOT.schemaVersion,
  release: RELEASE,
  division: DIVISION,
  sourceRepository: 'https://github.com/mlcommons/inference_results_v6.0',
  sourceCommit: SNAPSHOT.sourceCommit,
  recordsHash: SNAPSHOT.recordsHash,
  counts: {
    resultsTotal: SNAPSHOT.counts.total,
    resultsReleased: SNAPSHOT.counts.released,
    resultsQuarantined: SNAPSHOT.counts.quarantined,
    scenarioMismatches: SNAPSHOT.counts.scenarioMismatches,
    rows: ROWS.length,
    accelerators: new Set(ROWS.map((r) => r.acceleratorSlug)).size,
    slices: SLICES.length,
    comparableSlices: SLICES.filter((s) => s.comparable).length,
  },
} as const;

export const QUARANTINE = SNAPSHOT.quarantine;
export const SCENARIO_MISMATCHES = SNAPSHOT.scenarioMismatches;

export const ACCELERATORS = [...new Set(ROWS.map((r) => r.acceleratorSlug))]
  .sort()
  .map((slug) => {
    const row = ROWS.find((r) => r.acceleratorSlug === slug) as Row;
    return { slug, name: row.acceleratorName, vendor: row.vendor };
  });
