/**
 * Pipeline tests.
 *
 * These tests run in fixture mode and verify the structural guarantees
 * of the pipeline without requiring the full source directory.
 */

import { describe, it, expect, beforeAll } from 'bun:test';
import { join } from 'path';
import { runPipeline, deterministicJson } from './runner.js';
import type { Snapshot } from './schema.js';

// In Bun's CJS-compatible mode __dirname is always available.
const FIXTURES_DIR = join(__dirname, '../../fixtures');

let snapshot: Snapshot;

beforeAll(() => {
  snapshot = runPipeline({ mode: 'fixture', fixturesDir: FIXTURES_DIR });
});

describe('pipeline fixture mode', () => {
  it('produces a valid snapshot', () => {
    expect(snapshot).toBeDefined();
    expect(snapshot.schemaVersion).toBe('1.0.0');
    expect(snapshot.mode).toBe('fixture');
    expect(snapshot.sourceCommit).toHaveLength(40);
  });

  it('total = released + quarantined', () => {
    expect(snapshot.counts.total).toBe(
      snapshot.counts.released + snapshot.counts.quarantined
    );
  });

  it('has at least one NVIDIA result (released)', () => {
    const nvResult = snapshot.records.find((r) => r.submitter === 'nvidia');
    expect(nvResult).toBeDefined();
  });

  it('has at least one AMD result (released)', () => {
    const amdResult = snapshot.records.find((r) => r.submitter === 'amd');
    expect(amdResult).toBeDefined();
  });

  it('has at least one Intel result (released)', () => {
    const intelResult = snapshot.records.find((r) => r.submitter === 'intel');
    expect(intelResult).toBeDefined();
  });

  it('has at least one multi-accelerator result (released)', () => {
    const multiResult = snapshot.records.find(
      (r) => r.acceleratorCount > 1
    );
    expect(multiResult).toBeDefined();
    if (multiResult) {
      expect(multiResult.acceleratorCount).toBeGreaterThan(1);
    }
  });

  it('has exactly one quarantined result (the CPU-only case)', () => {
    expect(snapshot.counts.quarantined).toBe(1);
    const q = snapshot.quarantine[0];
    expect(q).toBeDefined();
    if (q) {
      expect(q.reasons.some((r) => r.includes('accelerators_per_node'))).toBe(true);
    }
  });

  it('quarantined result has reviewRequired = true', () => {
    for (const q of snapshot.quarantine) {
      expect(q.reviewRequired).toBe(true);
    }
  });

  it('all released records have acceleratorCount > 0', () => {
    for (const r of snapshot.records) {
      expect(r.acceleratorCount).toBeGreaterThan(0);
    }
  });

  it('detects the Interactive scenario mismatch (path vs log)', () => {
    expect(snapshot.counts.scenarioMismatches).toBeGreaterThanOrEqual(1);
    const mismatch = snapshot.scenarioMismatches[0];
    expect(mismatch).toBeDefined();
    if (mismatch) {
      expect(mismatch.scenarioFromPath).toBe('Interactive');
      expect(mismatch.scenarioInLog).toBe('Server');
    }
  });

  it('Interactive result is retained in released records (not quarantined because of mismatch)', () => {
    const interactiveRecords = snapshot.records.filter(
      (r) => r.scenario === 'Interactive'
    );
    expect(interactiveRecords.length).toBeGreaterThanOrEqual(1);
  });

  it('all released records have stable logicalId', () => {
    const ids = new Set(snapshot.records.map((r) => r.logicalId));
    expect(ids.size).toBe(snapshot.records.length);
  });

  it('all released records have a 64-char hex contentId', () => {
    for (const r of snapshot.records) {
      expect(r.contentId).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it('all released records have log and system source citations with sha256', () => {
    for (const r of snapshot.records) {
      expect(r.logSource.sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(r.systemSource.sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(r.logSource.commit).toBe('4d3916ac9cf474b679cdfcf492d43a0559418ad1');
    }
  });

  it('recordsHash matches SHA-256 of canonical records JSON', () => {
    const { createHash } = require('crypto');
    const expected = createHash('sha256')
      .update(deterministicJson(snapshot.records), 'utf8')
      .digest('hex');
    expect(snapshot.recordsHash).toBe(expected);
  });

  it('deterministic: two runs produce identical JSON', () => {
    const snapshot2 = runPipeline({ mode: 'fixture', fixturesDir: FIXTURES_DIR });
    expect(deterministicJson(snapshot2)).toBe(deterministicJson(snapshot));
  });

  it('scenario comes from path — no alias applied for Interactive (it is already canonical)', () => {
    const interactiveRecords = snapshot.records.filter(
      (r) => r.scenario === 'Interactive'
    );
    for (const r of interactiveRecords) {
      expect(r.scenarioRaw).toBe('Interactive');
    }
  });

  it('accelerator count = accelerators_per_node × number_of_nodes (not from name)', () => {
    const multiNode = snapshot.records.find((r) => r.acceleratorCount > 8);
    if (multiNode) {
      const apn = Number(multiNode.acceleratorsPerNodeRaw);
      const nn = Number(multiNode.numberOfNodesRaw);
      expect(multiNode.acceleratorCount).toBe(apn * nn);
    }
  });
});
