#!/usr/bin/env bun
/**
 * pipeline:full — parses all allowed result files from MLPERF_SOURCE_DIR
 * and writes / verifies the full-source snapshot hash.
 *
 * Environment:
 *   MLPERF_SOURCE_DIR  — path to the mlperf inference_results_v6.0 clone
 *                        (default: /home/forge/mlperf)
 *
 * Outputs:
 *   pipeline-output/full-snapshot.json        — full snapshot
 *   pipeline-output/full-hash.txt             — recordsHash
 *   pipeline-output/full-expected-hash.txt    — committed expected hash
 */

import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { runPipeline, deterministicJson } from '../src/pipeline/runner.js';

const APP_ROOT = join(import.meta.dir, '..');
const OUTPUT_DIR = join(APP_ROOT, 'pipeline-output');
const SOURCE_DIR =
  process.env['MLPERF_SOURCE_DIR'] ?? '/home/forge/mlperf';
const EXPECTED_HASH_FILE = join(OUTPUT_DIR, 'full-expected-hash.txt');
const SNAPSHOT_FILE = join(OUTPUT_DIR, 'full-snapshot.json');
const HASH_FILE = join(OUTPUT_DIR, 'full-hash.txt');

mkdirSync(OUTPUT_DIR, { recursive: true });

console.log(`Running pipeline in full-source mode...`);
console.log(`Source directory: ${SOURCE_DIR}`);

const snapshot = runPipeline({ mode: 'full-source', sourceDir: SOURCE_DIR });

const snapshotJson = deterministicJson(snapshot);
writeFileSync(SNAPSHOT_FILE, snapshotJson, 'utf8');
writeFileSync(HASH_FILE, snapshot.recordsHash, 'utf8');

console.log(`Records:     ${snapshot.counts.released} released, ${snapshot.counts.quarantined} quarantined`);
console.log(`Mismatches:  ${snapshot.counts.scenarioMismatches} scenario mismatches`);
console.log(`recordsHash: ${snapshot.recordsHash}`);

if (snapshot.counts.total !== 167) {
  console.warn(`WARNING: expected 167 total results, got ${snapshot.counts.total}`);
}
if (snapshot.counts.quarantined !== 12) {
  console.warn(`WARNING: expected 12 quarantined results, got ${snapshot.counts.quarantined}`);
}

// On first run, commit the expected hash.
if (!existsSync(EXPECTED_HASH_FILE)) {
  writeFileSync(EXPECTED_HASH_FILE, snapshot.recordsHash, 'utf8');
  console.log(`Wrote expected hash to ${EXPECTED_HASH_FILE}`);
} else {
  const expected = readFileSync(EXPECTED_HASH_FILE, 'utf8').trim();
  if (snapshot.recordsHash !== expected) {
    console.error(`ERROR: recordsHash mismatch!`);
    console.error(`  expected: ${expected}`);
    console.error(`  got:      ${snapshot.recordsHash}`);
    process.exit(1);
  }
  console.log('Hash matches expected. OK.');
}

console.log(`Snapshot written to ${SNAPSHOT_FILE}`);
