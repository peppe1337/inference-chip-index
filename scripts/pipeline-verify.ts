#!/usr/bin/env bun
/**
 * pipeline:verify — re-runs both modes and checks both hashes.
 * Exits non-zero if either hash does not match its committed expected value.
 *
 * This is the integrity gate.  Run it after any change to source data or
 * pipeline code to confirm no silent mutation occurred.
 */

import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { runPipeline, deterministicJson } from '../src/pipeline/runner.js';

const APP_ROOT = join(import.meta.dir, '..');
const OUTPUT_DIR = join(APP_ROOT, 'pipeline-output');
const FIXTURES_DIR = join(APP_ROOT, 'fixtures');
const SOURCE_DIR =
  process.env['MLPERF_SOURCE_DIR'] ?? '/home/forge/mlperf';

mkdirSync(OUTPUT_DIR, { recursive: true });

let exitCode = 0;

// ── Fixture mode ──────────────────────────────────────────────────────────────
const FIXTURE_EXPECTED_FILE = join(OUTPUT_DIR, 'fixture-expected-hash.txt');
if (!existsSync(FIXTURE_EXPECTED_FILE)) {
  console.error(
    `ERROR: fixture expected hash not found at ${FIXTURE_EXPECTED_FILE}. ` +
    `Run pipeline:fixture first.`
  );
  process.exit(1);
}

console.log('Verifying fixture mode...');
const fixtureSnapshot = runPipeline({ mode: 'fixture', fixturesDir: FIXTURES_DIR });
writeFileSync(join(OUTPUT_DIR, 'fixture-snapshot.json'), deterministicJson(fixtureSnapshot), 'utf8');
writeFileSync(join(OUTPUT_DIR, 'fixture-hash.txt'), fixtureSnapshot.recordsHash, 'utf8');

const fixtureExpected = readFileSync(FIXTURE_EXPECTED_FILE, 'utf8').trim();
if (fixtureSnapshot.recordsHash !== fixtureExpected) {
  console.error(`FAIL fixture: expected ${fixtureExpected}, got ${fixtureSnapshot.recordsHash}`);
  exitCode = 1;
} else {
  console.log(`PASS fixture: ${fixtureSnapshot.recordsHash}`);
}

// ── Full-source mode ──────────────────────────────────────────────────────────
const FULL_EXPECTED_FILE = join(OUTPUT_DIR, 'full-expected-hash.txt');
if (!existsSync(FULL_EXPECTED_FILE)) {
  console.error(
    `ERROR: full-source expected hash not found at ${FULL_EXPECTED_FILE}. ` +
    `Run pipeline:full first.`
  );
  process.exit(1);
}

console.log('Verifying full-source mode...');
const fullSnapshot = runPipeline({ mode: 'full-source', sourceDir: SOURCE_DIR });
writeFileSync(join(OUTPUT_DIR, 'full-snapshot.json'), deterministicJson(fullSnapshot), 'utf8');
writeFileSync(join(OUTPUT_DIR, 'full-hash.txt'), fullSnapshot.recordsHash, 'utf8');

const fullExpected = readFileSync(FULL_EXPECTED_FILE, 'utf8').trim();
if (fullSnapshot.recordsHash !== fullExpected) {
  console.error(`FAIL full-source: expected ${fullExpected}, got ${fullSnapshot.recordsHash}`);
  exitCode = 1;
} else {
  console.log(`PASS full-source: ${fullSnapshot.recordsHash}`);
}

if (exitCode === 0) {
  console.log('All hashes verified. OK.');
} else {
  console.error('Verification FAILED.');
}

process.exit(exitCode);
