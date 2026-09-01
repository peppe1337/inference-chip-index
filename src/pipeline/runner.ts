/**
 * Pipeline runner.
 *
 * Two modes:
 *   fixture    — parses files under the local fixtures/ directory
 *   full-source — parses all allowed files in MLPERF_SOURCE_DIR
 *
 * Outputs a Snapshot:
 *   - deterministic JSON (sorted keys, no timestamps in content)
 *   - stable logical IDs
 *   - content IDs (SHA-256 over canonical content)
 *   - quarantine report
 *   - scenario mismatch report
 *   - coverage matrix
 *   - top-level recordsHash for verify
 */

import { createHash } from 'crypto';
import { existsSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { parseResultDirectory, type ParsedResult } from './parser.js';
import {
  ALLOWED_WORKLOADS,
  LOG_FILE_NAME,
  PINNED_COMMIT,
} from './source-registry.js';
import {
  SnapshotSchema,
  PublishedRecordSchema,
  QuarantineEntrySchema,
  ScenarioMismatchReportSchema,
  CoverageMatrixCellSchema,
  type Snapshot,
  type PublishedRecord,
  type QuarantineEntry,
  type ScenarioMismatchReport,
  type CoverageMatrixCell,
} from './schema.js';

// ── Deterministic JSON ────────────────────────────────────────────────────────

/**
 * Produces deterministic JSON with sorted keys at every level.
 * No timestamps in content.
 */
export function deterministicJson(value: unknown): string {
  return JSON.stringify(sortKeys(value), null, 2);
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortKeys);
  }
  if (value !== null && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    return Object.fromEntries(
      Object.keys(obj)
        .sort()
        .map((k) => [k, sortKeys(obj[k])])
    );
  }
  return value;
}

function sha256Hex(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

// ── Logical ID ────────────────────────────────────────────────────────────────

/**
 * Builds a stable logical ID from the path components.
 * Format: <submitter>/<systemId>/<workload>/<scenario>
 * (uses canonical values after alias resolution)
 */
function buildLogicalId(result: ParsedResult): string {
  return [result.submitter, result.systemId, result.workload, result.scenario]
    .map((s) => s.replace(/\//g, '_'))
    .join('/');
}

/**
 * Builds a content ID from the canonical JSON of the record content.
 * The content is defined as the parsed result fields (not the wrapper IDs).
 */
function buildContentId(result: ParsedResult): string {
  const content = deterministicJson({
    submitter: result.submitter,
    systemId: result.systemId,
    workload: result.workload,
    workloadRaw: result.workloadRaw,
    scenario: result.scenario,
    scenarioRaw: result.scenarioRaw,
    scenarioInLog: result.scenarioInLog,
    acceleratorName: result.acceleratorName,
    acceleratorNameRaw: result.acceleratorNameRaw,
    acceleratorCount: result.acceleratorCount,
    acceleratorsPerNodeRaw: result.acceleratorsPerNodeRaw,
    numberOfNodesRaw: result.numberOfNodesRaw,
    valid: result.valid,
    metrics: result.metrics,
    logSource: result.logSource,
    systemSource: result.systemSource,
  });
  return sha256Hex(content);
}

// ── Scanner ───────────────────────────────────────────────────────────────────

interface ScanEntry {
  logFilePath: string;
  systemJsonPath: string;
  submitter: string;
  systemId: string;
  workloadRaw: string;
  scenarioRaw: string;
}

/**
 * Scans the given base directory for result files matching the pattern:
 *   <base>/closed/<submitter>/results/<systemId>/<workload>/<scenario>/performance/run_1/mlperf_log_summary.txt
 *
 * Exclusions:
 *   - workloads not in ALLOWED_WORKLOADS
 *   - paths containing a TEST segment
 */
function scanSourceDir(baseDir: string): ScanEntry[] {
  const closedDir = join(baseDir, 'closed');
  if (!existsSync(closedDir)) {
    throw new Error(`closed/ directory not found under ${baseDir}`);
  }

  const entries: ScanEntry[] = [];

  for (const submitter of readdirSync(closedDir)) {
    const submitterPath = join(closedDir, submitter);
    if (!statSync(submitterPath).isDirectory()) continue;

    const resultsPath = join(submitterPath, 'results');
    if (!existsSync(resultsPath)) continue;

    const systemsPath = join(submitterPath, 'systems');
    if (!existsSync(systemsPath)) continue;

    for (const systemId of readdirSync(resultsPath)) {
      const systemResultsPath = join(resultsPath, systemId);
      if (!statSync(systemResultsPath).isDirectory()) continue;

      const systemJsonPath = join(systemsPath, `${systemId}.json`);
      if (!existsSync(systemJsonPath)) continue;

      for (const workloadRaw of readdirSync(systemResultsPath)) {
        // Only allowed workloads
        if (!(ALLOWED_WORKLOADS as readonly string[]).includes(workloadRaw)) {
          continue;
        }

        const workloadPath = join(systemResultsPath, workloadRaw);
        if (!statSync(workloadPath).isDirectory()) continue;

        for (const scenarioRaw of readdirSync(workloadPath)) {
          // Skip TEST* directories
          if (scenarioRaw.startsWith('TEST')) continue;

          const scenarioPath = join(workloadPath, scenarioRaw);
          if (!statSync(scenarioPath).isDirectory()) continue;

          const logFilePath = join(
            scenarioPath,
            'performance',
            'run_1',
            LOG_FILE_NAME
          );
          if (!existsSync(logFilePath)) continue;

          entries.push({
            logFilePath,
            systemJsonPath,
            submitter,
            systemId,
            workloadRaw,
            scenarioRaw,
          });
        }
      }
    }
  }

  // Sort for determinism
  entries.sort((a, b) => {
    const ka = `${a.submitter}/${a.systemId}/${a.workloadRaw}/${a.scenarioRaw}`;
    const kb = `${b.submitter}/${b.systemId}/${b.workloadRaw}/${b.scenarioRaw}`;
    return ka < kb ? -1 : ka > kb ? 1 : 0;
  });

  return entries;
}

/**
 * Scans the fixture directory which has the same sub-structure as the real
 * repo but with the submitter directory directly at the root.
 *
 * Structure under fixturesDir:
 *   <fixturesDir>/<fixture-name>/results/<systemId>/<workload>/<scenario>/...
 *   <fixturesDir>/<fixture-name>/systems/<systemId>.json
 *
 * We treat <fixture-name> as the submitter for the purposes of logical IDs.
 */
function scanFixtureDir(fixturesDir: string): ScanEntry[] {
  if (!existsSync(fixturesDir)) {
    throw new Error(`Fixtures directory not found: ${fixturesDir}`);
  }

  const entries: ScanEntry[] = [];

  for (const fixtureName of readdirSync(fixturesDir)) {
    const fixturePath = join(fixturesDir, fixtureName);
    if (!statSync(fixturePath).isDirectory()) continue;

    const resultsPath = join(fixturePath, 'results');
    if (!existsSync(resultsPath)) continue;

    const systemsPath = join(fixturePath, 'systems');
    if (!existsSync(systemsPath)) continue;

    for (const systemId of readdirSync(resultsPath)) {
      const systemResultsPath = join(resultsPath, systemId);
      if (!statSync(systemResultsPath).isDirectory()) continue;

      const systemJsonPath = join(systemsPath, `${systemId}.json`);
      if (!existsSync(systemJsonPath)) continue;

      for (const workloadRaw of readdirSync(systemResultsPath)) {
        if (!(ALLOWED_WORKLOADS as readonly string[]).includes(workloadRaw)) {
          continue;
        }

        const workloadPath = join(systemResultsPath, workloadRaw);
        if (!statSync(workloadPath).isDirectory()) continue;

        for (const scenarioRaw of readdirSync(workloadPath)) {
          if (scenarioRaw.startsWith('TEST')) continue;

          const scenarioPath = join(workloadPath, scenarioRaw);
          if (!statSync(scenarioPath).isDirectory()) continue;

          const logFilePath = join(
            scenarioPath,
            'performance',
            'run_1',
            LOG_FILE_NAME
          );
          if (!existsSync(logFilePath)) continue;

          entries.push({
            logFilePath,
            systemJsonPath,
            submitter: fixtureName,
            systemId,
            workloadRaw,
            scenarioRaw,
          });
        }
      }
    }
  }

  entries.sort((a, b) => {
    const ka = `${a.submitter}/${a.systemId}/${a.workloadRaw}/${a.scenarioRaw}`;
    const kb = `${b.submitter}/${b.systemId}/${b.workloadRaw}/${b.scenarioRaw}`;
    return ka < kb ? -1 : ka > kb ? 1 : 0;
  });

  return entries;
}

// ── Pipeline run ──────────────────────────────────────────────────────────────

export type PipelineMode = 'fixture' | 'full-source';

export interface RunOptions {
  mode: PipelineMode;
  /** Base directory for the source (MLPERF_SOURCE_DIR). Only for full-source mode. */
  sourceDir?: string;
  /** Fixtures directory path. Only for fixture mode. */
  fixturesDir?: string;
  /**
   * For full-source mode the repoRoot is the sourceDir itself.
   * For fixture mode the repoRoot is a special marker so citations show
   * fixture paths.
   */
  repoRoot?: string;
}

export function runPipeline(opts: RunOptions): Snapshot {
  const { mode } = opts;

  // ── Scan ──────────────────────────────────────────────────────────────────
  let scanEntries: ScanEntry[];
  let repoRoot: string;

  if (mode === 'full-source') {
    const sourceDir =
      opts.sourceDir ??
      process.env['MLPERF_SOURCE_DIR'] ??
      '/home/forge/mlperf';
    repoRoot = sourceDir;
    scanEntries = scanSourceDir(sourceDir);
  } else {
    const fixturesDir =
      opts.fixturesDir ??
      join(process.cwd(), 'fixtures');
    repoRoot = fixturesDir;
    scanEntries = scanFixtureDir(fixturesDir);
  }

  // ── Parse ─────────────────────────────────────────────────────────────────
  const allResults: ParsedResult[] = scanEntries.map((entry) =>
    parseResultDirectory({
      logFilePath: entry.logFilePath,
      systemJsonPath: entry.systemJsonPath,
      repoRoot,
      submitter: entry.submitter,
      systemId: entry.systemId,
      workloadRaw: entry.workloadRaw,
      scenarioRaw: entry.scenarioRaw,
    })
  );

  // ── Separate quarantined vs released ──────────────────────────────────────
  const quarantinedResults = allResults.filter((r) => r.reviewRequired);
  const releasedResults = allResults.filter((r) => !r.reviewRequired);

  // ── Build quarantine report ───────────────────────────────────────────────
  const quarantine: QuarantineEntry[] = quarantinedResults.map((r) => {
    const logicalId = buildLogicalId(r);
    return QuarantineEntrySchema.parse({
      logicalId,
      submitter: r.submitter,
      systemId: r.systemId,
      workload: r.workload,
      scenario: r.scenario,
      reasons: r.quarantineReasons,
      reviewRequired: true,
      logSource: r.logSource,
      systemSource: r.systemSource,
    });
  });

  // ── Build scenario mismatch report ────────────────────────────────────────
  // All results (including quarantined) that have a mismatch are reported.
  const scenarioMismatches: ScenarioMismatchReport[] = allResults
    .filter((r) => r.scenarioMismatch)
    .map((r) => {
      const logicalId = buildLogicalId(r);
      return ScenarioMismatchReportSchema.parse({
        logicalId,
        submitter: r.submitter,
        systemId: r.systemId,
        workload: r.workload,
        scenarioFromPath: r.scenario,
        scenarioInLog: r.scenarioInLog,
        note:
          'Known case: Interactive directories in MLPerf v6.0 log Scenario: Server. ' +
          'The path scenario (Interactive) is authoritative per pipeline rules. ' +
          'These results are valid and retained; only the scenario label source differs.',
      });
    });

  // ── Build published records ───────────────────────────────────────────────
  const records: PublishedRecord[] = releasedResults.map((r) => {
    const logicalId = buildLogicalId(r);
    const contentId = buildContentId(r);
    return PublishedRecordSchema.parse({
      ...r,
      logicalId,
      contentId,
    });
  });

  // ── Build coverage matrix ─────────────────────────────────────────────────
  const coverageMatrix: CoverageMatrixCell[] = allResults.map((r) =>
    CoverageMatrixCellSchema.parse({
      workload: r.workload,
      scenario: r.scenario,
      submitter: r.submitter,
      systemId: r.systemId,
      acceleratorName: r.acceleratorName,
      acceleratorCount: r.acceleratorCount,
      reviewRequired: r.reviewRequired,
    })
  );

  // ── Records hash ──────────────────────────────────────────────────────────
  // Hash over the canonical JSON of the records array.
  const recordsHash = sha256Hex(deterministicJson(records));

  // ── Assemble snapshot ─────────────────────────────────────────────────────
  const snapshot = SnapshotSchema.parse({
    schemaVersion: '1.0.0',
    mode,
    sourceCommit: PINNED_COMMIT,
    counts: {
      total: allResults.length,
      released: releasedResults.length,
      quarantined: quarantinedResults.length,
      scenarioMismatches: scenarioMismatches.length,
    },
    records,
    quarantine,
    scenarioMismatches,
    coverageMatrix,
    recordsHash,
  });

  return snapshot;
}
