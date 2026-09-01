#!/usr/bin/env bun
/**
 * pipeline:fixture — parses fixture files and writes / verifies
 * the expected fixture snapshot hash.
 *
 * Outputs:
 *   pipeline-output/fixture-snapshot.json   — full snapshot
 *   pipeline-output/fixture-hash.txt        — recordsHash
 *   pipeline-output/fixture-expected-hash.txt — committed expected hash (written on first run)
 */

import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { runPipeline, deterministicJson } from '../src/pipeline/runner.js';

const APP_ROOT = join(import.meta.dir, '..');
const OUTPUT_DIR = join(APP_ROOT, 'pipeline-output');
const FIXTURES_DIR = join(APP_ROOT, 'fixtures');
const EXPECTED_HASH_FILE = join(OUTPUT_DIR, 'fixture-expected-hash.txt');
const SNAPSHOT_FILE = join(OUTPUT_DIR, 'fixture-snapshot.json');
const HASH_FILE = join(OUTPUT_DIR, 'fixture-hash.txt');

mkdirSync(OUTPUT_DIR, { recursive: true });

console.log('Running pipeline in fixture mode...');
const snapshot = runPipeline({ mode: 'fixture', fixturesDir: FIXTURES_DIR });

const snapshotJson = deterministicJson(snapshot);
writeFileSync(SNAPSHOT_FILE, snapshotJson, 'utf8');
writeFileSync(HASH_FILE, snapshot.recordsHash, 'utf8');

console.log(`Records:     ${snapshot.counts.released} released, ${snapshot.counts.quarantined} quarantined`);
console.log(`Mismatches:  ${snapshot.counts.scenarioMismatches} scenario mismatches`);
console.log(`recordsHash: ${snapshot.recordsHash}`);

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
