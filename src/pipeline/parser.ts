/**
 * Parser — reads mlperf_log_summary.txt and its companion <system_id>.json,
 * and produces a ParsedResult per result directory.
 *
 * Hard rules (from the task brief and DATENBEFUND):
 *  1. Scenario comes from the PATH, not from the log file.
 *     Interactive directories log "Scenario : Server"; we record the path
 *     scenario and note the mismatch.
 *  2. Accelerator count = accelerators_per_node × number_of_nodes.
 *     Fields may be strings or numbers — coerced explicitly.
 *  3. accelerators_per_node === 0 → quarantine (review-required).
 *  4. No toLowerCase(), no replace('_','.') — all normalisation goes through
 *     the alias registry.
 */

import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import { join, relative } from 'path';
import { resolveAlias } from './alias-registry.js';
import { findMetricByLogKey } from './metric-registry.js';
import {
  PINNED_COMMIT,
  REPO_REMOTE,
  buildGithubUrl,
} from './source-registry.js';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SourceCitation {
  repository: string;
  commit: string;
  /** Relative path within the repository. */
  path: string;
  /** Direct GitHub HTTPS link at the pinned commit. */
  url: string;
  /** SHA-256 hex digest of the file bytes. */
  sha256: string;
}

export interface ParsedMetric {
  metricId: string;
  logKey: string;
  value: number;
  unit: string;
}

export interface ParsedResult {
  /** Submitter name (from path). */
  submitter: string;
  /** System identifier (directory name under results/). */
  systemId: string;
  /** Canonical workload name (after alias resolution). */
  workload: string;
  /** Raw workload string as found in the path. */
  workloadRaw: string;
  /** Canonical scenario name (from path, after alias resolution). */
  scenario: string;
  /** Raw scenario string as found in the path. */
  scenarioRaw: string;
  /**
   * Scenario as reported in the log file.
   * Recorded for audit; if it differs from the path scenario this is noted
   * in the quarantine report.
   */
  scenarioInLog: string | null;
  /**
   * True when the path scenario and the log-file scenario differ.
   * Known case: all 17 Interactive directories log "Server".
   */
  scenarioMismatch: boolean;
  /** Accelerator model name after alias resolution. */
  acceleratorName: string;
  /** Raw accelerator model name as in the system JSON. */
  acceleratorNameRaw: string;
  /** accelerators_per_node × number_of_nodes (both fields coerced to number). */
  acceleratorCount: number;
  /** Raw accelerators_per_node field value (may be string "0"). */
  acceleratorsPerNodeRaw: string | number;
  /** Raw number_of_nodes field value (may be string). */
  numberOfNodesRaw: string | number;
  /** Whether the result passed the validity check in the log. */
  valid: boolean;
  /** Parsed metrics from the log summary. */
  metrics: ReadonlyArray<ParsedMetric>;
  /** Source citation for the log file. */
  logSource: SourceCitation;
  /** Source citation for the system JSON. */
  systemSource: SourceCitation;
  /**
   * Whether this result requires human review before publication.
   * Reasons are listed in quarantineReasons.
   */
  reviewRequired: boolean;
  quarantineReasons: ReadonlyArray<string>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function sha256Hex(buf: Buffer): string {
  return createHash('sha256').update(buf).digest('hex');
}

function readWithHash(filePath: string): { text: string; sha256: string } {
  const buf = readFileSync(filePath);
  return { text: buf.toString('utf8'), sha256: sha256Hex(buf) };
}

function coerceToNumber(val: string | number | undefined): number {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') return parseInt(val, 10);
  return NaN;
}

/**
 * Builds a SourceCitation given an absolute file path, the absolute repo root,
 * and a known relative path prefix (the division + submitter segment).
 */
function buildCitation(
  absolutePath: string,
  repoRoot: string,
  sha256: string
): SourceCitation {
  const relPath = relative(repoRoot, absolutePath).replace(/\\/g, '/');
  return {
    repository: REPO_REMOTE,
    commit: PINNED_COMMIT,
    path: relPath,
    url: buildGithubUrl(relPath),
    sha256,
  };
}

// ── Log parser ────────────────────────────────────────────────────────────────

interface LogParseResult {
  scenarioInLog: string | null;
  valid: boolean;
  metrics: ParsedMetric[];
  /**
   * Metric IDs that appeared more than once in the log with DIFFERENT values.
   * Measured over all 284 in-scope v6.0 summaries this is always empty, but a
   * contradictory repeat must never be silently resolved by picking one — it is
   * a genuine ambiguity and quarantines the record.
   */
  metricConflicts: string[];
}

/**
 * MLPerf v6.0 summaries print "Completed tokens per second" TWICE (the two lines
 * differ only in padding). Measured across all 284 in-scope summaries: this is
 * the only repeated key, it occurs in 154 files, and the two values are always
 * identical. We therefore collapse exact repeats and flag contradictions.
 */
function collapseRepeatedMetrics(metrics: ParsedMetric[]): {
  metrics: ParsedMetric[];
  metricConflicts: string[];
} {
  const seen = new Map<string, ParsedMetric>();
  const conflicts = new Set<string>();
  for (const m of metrics) {
    const prev = seen.get(m.metricId);
    if (!prev) {
      seen.set(m.metricId, m);
    } else if (prev.value !== m.value || prev.unit !== m.unit) {
      conflicts.add(m.metricId);
    }
  }
  return { metrics: [...seen.values()], metricConflicts: [...conflicts].sort() };
}

function parseLogSummary(text: string): LogParseResult {
  const lines = text.split('\n');
  let scenarioInLog: string | null = null;
  let valid = false;
  const metrics: ParsedMetric[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    // Scenario line: "Scenario : Offline"
    const scenarioMatch = trimmed.match(/^Scenario\s*:\s*(.+)$/);
    if (scenarioMatch) {
      scenarioInLog = (scenarioMatch[1] ?? '').trim();
      continue;
    }

    // Validity line: "Result is : VALID"
    if (/^Result is\s*:\s*VALID$/.test(trimmed)) {
      valid = true;
      continue;
    }

    // Metric lines — try all registered log keys.
    // The log format uses either "Key: value" or "Key    : value".
    // We match the trimmed line against known prefixes.
    for (const [logKey, def] of [
      ['Samples per second', 'offline-samples-per-second'],
      ['Tokens per second', 'offline-tokens-per-second'],
      ['Completed samples per second', 'server-completed-samples-per-second'],
      ['Completed tokens per second', 'server-completed-tokens-per-second'],
      ['Scheduled samples per second', 'server-scheduled-samples-per-second'],
    ] as const) {
      // Match e.g. "Samples per second: 36.07" or "Completed samples per second    : 658.41"
      if (trimmed.startsWith(logKey)) {
        const rest = trimmed.slice(logKey.length).trim();
        if (rest.startsWith(':')) {
          const valStr = rest.slice(1).trim();
          const value = parseFloat(valStr);
          if (!isNaN(value)) {
            const metricDef = findMetricByLogKey(logKey);
            if (metricDef) {
              metrics.push({
                metricId: metricDef.id,
                logKey,
                value,
                unit: metricDef.canonicalUnit,
              });
            }
          }
        }
        break;
      }
    }
  }

  const collapsed = collapseRepeatedMetrics(metrics);
  return { scenarioInLog, valid, metrics: collapsed.metrics, metricConflicts: collapsed.metricConflicts };
}

// ── Main entry point ──────────────────────────────────────────────────────────

/**
 * Parses a single result directory.
 *
 * @param logFilePath    Absolute path to mlperf_log_summary.txt
 * @param systemJsonPath Absolute path to <system_id>.json
 * @param repoRoot       Absolute path to the repository root (for citation paths)
 * @param submitter      Submitter name (extracted from path by the scanner)
 * @param systemId       System ID (directory name)
 * @param workloadRaw    Raw workload string from the path
 * @param scenarioRaw    Raw scenario string from the path
 */
export function parseResultDirectory(opts: {
  logFilePath: string;
  systemJsonPath: string;
  repoRoot: string;
  submitter: string;
  systemId: string;
  workloadRaw: string;
  scenarioRaw: string;
}): ParsedResult {
  const {
    logFilePath,
    systemJsonPath,
    repoRoot,
    submitter,
    systemId,
    workloadRaw,
    scenarioRaw,
  } = opts;

  // ── Read files ──────────────────────────────────────────────────────────────
  const { text: logText, sha256: logSha256 } = readWithHash(logFilePath);
  const { text: sysText, sha256: sysSha256 } = readWithHash(systemJsonPath);

  const systemJson = JSON.parse(sysText) as Record<string, unknown>;

  // ── Build citations ─────────────────────────────────────────────────────────
  const logSource = buildCitation(logFilePath, repoRoot, logSha256);
  const systemSource = buildCitation(systemJsonPath, repoRoot, sysSha256);

  // ── Parse log ──────────────────────────────────────────────────────────────
  const { scenarioInLog, valid, metrics, metricConflicts } = parseLogSummary(logText);

  // ── Resolve workload alias ──────────────────────────────────────────────────
  const workloadResolved = resolveAlias(workloadRaw, 'workload');
  const workload = workloadResolved.canonical;

  // ── Resolve scenario from PATH (rule: path is authoritative) ───────────────
  const scenarioResolved = resolveAlias(scenarioRaw, 'scenario');
  const scenario = scenarioResolved.canonical;

  // ── Detect scenario mismatch (Interactive in path, Server in log) ───────────
  const scenarioMismatch =
    scenarioInLog !== null && scenarioInLog !== scenario;

  // ── Accelerator fields ──────────────────────────────────────────────────────
  const acceleratorsPerNodeRaw = (systemJson['accelerators_per_node'] ??
    '') as string | number;
  const numberOfNodesRaw = (systemJson['number_of_nodes'] ?? '') as
    | string
    | number;

  const acceleratorsPerNode = coerceToNumber(acceleratorsPerNodeRaw);
  const numberOfNodes = coerceToNumber(numberOfNodesRaw);
  const acceleratorCount = acceleratorsPerNode * numberOfNodes;

  // ── Resolve accelerator name alias ─────────────────────────────────────────
  const acceleratorNameRaw = String(
    systemJson['accelerator_model_name'] ?? ''
  );
  const accelResolved = resolveAlias(acceleratorNameRaw, 'accelerator');
  const acceleratorName = accelResolved.canonical;

  // ── Quarantine checks ───────────────────────────────────────────────────────
  const quarantineReasons: string[] = [];

  // Rule: accelerators_per_node === 0 → review-required, no ranking allowed
  if (acceleratorsPerNode === 0) {
    quarantineReasons.push(
      `accelerators_per_node is ${JSON.stringify(acceleratorsPerNodeRaw)} (zero) — ` +
        'cannot derive per-accelerator metrics; likely a CPU-only submission.'
    );
  }

  // Flag: accelerator name was not aliased but contains parenthetical quantity
  // annotations (e.g. "(x94)") that were NOT caught by the alias registry —
  // this would indicate a missing alias entry, not a parser bug.
  if (!accelResolved.aliasApplied && /\(x\d+\)/i.test(acceleratorNameRaw)) {
    quarantineReasons.push(
      `Accelerator name "${acceleratorNameRaw}" contains a parenthetical quantity ` +
        'annotation but has no alias entry — review required.'
    );
  }

  // Rule: the same metric logged twice with different values is an unresolvable
  // ambiguity. Picking either one would be a fabrication.
  for (const metricId of metricConflicts) {
    quarantineReasons.push(
      `Metric "${metricId}" appears more than once in the log summary with ` +
        'differing values — cannot decide which is authoritative; review required.'
    );
  }

  const reviewRequired = quarantineReasons.length > 0;

  return {
    submitter,
    systemId,
    workload,
    workloadRaw,
    scenario,
    scenarioRaw,
    scenarioInLog,
    scenarioMismatch,
    acceleratorName,
    acceleratorNameRaw,
    acceleratorCount,
    acceleratorsPerNodeRaw,
    numberOfNodesRaw,
    valid,
    metrics,
    logSource,
    systemSource,
    reviewRequired,
    quarantineReasons,
  };
}
