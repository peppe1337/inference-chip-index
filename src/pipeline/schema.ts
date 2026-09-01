/**
 * Zod validation schemas for pipeline output records.
 *
 * Every published record must pass these schemas before it can be released.
 * Validation is atomic: the entire batch is rejected if any record fails.
 */

import { z } from 'zod';

// ── Building blocks ───────────────────────────────────────────────────────────

export const SourceCitationSchema = z.object({
  repository: z.string().url(),
  commit: z.string().min(40).max(40),
  path: z.string().min(1),
  url: z.string().url(),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
});

export const ParsedMetricSchema = z.object({
  metricId: z.string().min(1),
  logKey: z.string().min(1),
  value: z.number().finite(),
  unit: z.string().min(1),
});

// ── Core result record ────────────────────────────────────────────────────────

export const ParsedResultSchema = z.object({
  submitter: z.string().min(1),
  systemId: z.string().min(1),
  workload: z.string().min(1),
  workloadRaw: z.string().min(1),
  scenario: z.string().min(1),
  scenarioRaw: z.string().min(1),
  scenarioInLog: z.string().nullable(),
  scenarioMismatch: z.boolean(),
  acceleratorName: z.string().min(1),
  acceleratorNameRaw: z.string(),
  acceleratorCount: z.number().int(),
  acceleratorsPerNodeRaw: z.union([z.string(), z.number()]),
  numberOfNodesRaw: z.union([z.string(), z.number()]),
  valid: z.boolean(),
  metrics: z.array(ParsedMetricSchema),
  logSource: SourceCitationSchema,
  systemSource: SourceCitationSchema,
  reviewRequired: z.boolean(),
  quarantineReasons: z.array(z.string()),
});

// ── Published record (with stable IDs) ────────────────────────────────────────

/**
 * A published result record has:
 *   - logicalId: stable identifier derived from (submitter, systemId, workload, scenario)
 *   - contentId: SHA-256 of the record's canonical JSON content (for change detection)
 *
 * Content IDs change when source files change; logical IDs are stable across
 * re-runs as long as the path structure does not change.
 */
export const PublishedRecordSchema = ParsedResultSchema.extend({
  logicalId: z.string().min(1),
  contentId: z.string().regex(/^[0-9a-f]{64}$/),
});

export type PublishedRecord = z.infer<typeof PublishedRecordSchema>;

// ── Quarantine entry ──────────────────────────────────────────────────────────

export const QuarantineEntrySchema = z.object({
  logicalId: z.string().min(1),
  submitter: z.string().min(1),
  systemId: z.string().min(1),
  workload: z.string().min(1),
  scenario: z.string().min(1),
  reasons: z.array(z.string().min(1)),
  /** If true, the result is still valid but excluded from accelerator rankings. */
  reviewRequired: z.literal(true),
  logSource: SourceCitationSchema,
  systemSource: SourceCitationSchema,
});

export type QuarantineEntry = z.infer<typeof QuarantineEntrySchema>;

// ── Scenario mismatch report ──────────────────────────────────────────────────

export const ScenarioMismatchReportSchema = z.object({
  logicalId: z.string().min(1),
  submitter: z.string().min(1),
  systemId: z.string().min(1),
  workload: z.string().min(1),
  scenarioFromPath: z.string().min(1),
  scenarioInLog: z.string().nullable(),
  note: z.string().min(1),
});

export type ScenarioMismatchReport = z.infer<typeof ScenarioMismatchReportSchema>;

// ── Coverage matrix cell ──────────────────────────────────────────────────────

export const CoverageMatrixCellSchema = z.object({
  workload: z.string().min(1),
  scenario: z.string().min(1),
  submitter: z.string().min(1),
  systemId: z.string().min(1),
  acceleratorName: z.string().min(1),
  acceleratorCount: z.number().int(),
  reviewRequired: z.boolean(),
});

export type CoverageMatrixCell = z.infer<typeof CoverageMatrixCellSchema>;

// ── Snapshot (the full pipeline output) ──────────────────────────────────────

export const SnapshotSchema = z.object({
  /**
   * Schema version — bump when the output format changes incompatibly.
   */
  schemaVersion: z.literal('1.0.0'),
  /**
   * Pipeline mode: "fixture" or "full-source".
   */
  mode: z.enum(['fixture', 'full-source']),
  /**
   * Pinned source commit.
   */
  sourceCommit: z.string().min(40).max(40),
  /**
   * Counts — for quick sanity checks.
   */
  counts: z.object({
    total: z.number().int().nonnegative(),
    released: z.number().int().nonnegative(),
    quarantined: z.number().int().nonnegative(),
    scenarioMismatches: z.number().int().nonnegative(),
  }),
  /**
   * Released records — validated, deterministically ordered.
   */
  records: z.array(PublishedRecordSchema),
  /**
   * Quarantine report — records that require human review.
   */
  quarantine: z.array(QuarantineEntrySchema),
  /**
   * Scenario mismatch report — records where path and log disagree.
   * Interactive results are included in records (not quarantined because of
   * the mismatch), but the mismatch is documented here.
   */
  scenarioMismatches: z.array(ScenarioMismatchReportSchema),
  /**
   * Coverage matrix — one cell per released result.
   */
  coverageMatrix: z.array(CoverageMatrixCellSchema),
  /**
   * SHA-256 of the canonical JSON of the records array alone.
   * Used by pipeline:verify to detect changes.
   */
  recordsHash: z.string().regex(/^[0-9a-f]{64}$/),
});

export type Snapshot = z.infer<typeof SnapshotSchema>;
