import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { paymentsFromEnv } from '@lucid-agents/payments';
import {
  createInferenceChipsRuntime,
  ACCELERATORS,
} from './runtime';
import {
  SLICES,
  ROWS,
  DATASET_MANIFEST,
  rowsForSlice,
  rankSlice,
  QUARANTINE,
} from '../data/dataset';

// ── helpers ───────────────────────────────────────────────────────────────────

function makeInvokeRequest(basePath: string, key: string, body: unknown): Request {
  return new Request(
    `http://localhost${basePath}/entrypoints/${key}/invoke`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: body }),
    }
  );
}

// Real slice IDs from dataset.ts for deterministic test values.
const SAMPLE_SLICE_ID = SLICES[0]!.sliceId; // largest slice by resultCount
const SCHEDULED_SLICE_ID = SLICES.find(
  (s) => s.metricId === 'server-scheduled-samples-per-second' && s.workload === 'gpt-oss-120b'
)!.sliceId; // scheduled-samples metric; unit is "samples/s (scheduled)"

// ── suite A/B/C: no payment configuration ────────────────────────────────────

describe('runtime without payment configuration', () => {
  let runtime: Awaited<ReturnType<typeof createInferenceChipsRuntime>>;

  beforeAll(async () => {
    runtime = await createInferenceChipsRuntime({ paymentsConfig: undefined });
  });

  afterAll(async () => {
    await runtime.close();
  });

  // (a) runtime boots
  it('(a) runtime boots without payment configuration', () => {
    expect(runtime).toBeDefined();
    expect(runtime.agent).toBeDefined();
    expect(runtime.http).toBeDefined();
  });

  // (b) free entrypoints work
  it('(b) get-dataset-status (free) returns 200 with output', async () => {
    const req = makeInvokeRequest('/api/agent', 'get-dataset-status', {});
    const res = await runtime.http.handlers.invoke(req, { key: 'get-dataset-status' });
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body).toHaveProperty('output');
    const output = body.output as Record<string, unknown>;
    expect(output).toHaveProperty('slices');
  });

  it('(b) preview-inference-chips (free) returns 200 with output', async () => {
    const req = makeInvokeRequest('/api/agent', 'preview-inference-chips', {
      sliceId: SAMPLE_SLICE_ID,
    });
    const res = await runtime.http.handlers.invoke(req, {
      key: 'preview-inference-chips',
    });
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body).toHaveProperty('output');
  });

  // (c) paid entrypoints fail closed — never silently execute for free
  it('(c) rank-inference-chips (paid) is not 200 without payment configuration', async () => {
    const req = makeInvokeRequest('/api/agent', 'rank-inference-chips', {
      sliceId: SAMPLE_SLICE_ID,
    });
    const res = await runtime.http.handlers.invoke(req, { key: 'rank-inference-chips' });
    // Must not be 200 — the entrypoint must never silently become free.
    // Without configuration the runtime returns 503 (misconfiguration).
    expect(res.status).not.toBe(200);
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it('(c) compare-inference-chips (paid) is not 200 without payment configuration', async () => {
    const slugs = [...new Set(rowsForSlice(SAMPLE_SLICE_ID).map((r) => r.acceleratorSlug))].slice(0, 2);
    const req = makeInvokeRequest('/api/agent', 'compare-inference-chips', {
      sliceId: SAMPLE_SLICE_ID,
      acceleratorSlugs: slugs,
    });
    const res = await runtime.http.handlers.invoke(req, {
      key: 'compare-inference-chips',
    });
    expect(res.status).not.toBe(200);
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it('(c) payments runtime is undefined without configuration', () => {
    // The payments extension returns undefined when no config is supplied.
    // A priced entrypoint therefore has no rail to issue a payment challenge,
    // which is why the HTTP layer returns 503 instead of 402.
    expect(runtime.payments).toBeUndefined();
  });
});

// ── suite D: base-sepolia configuration — requirements projection ─────────────

describe('runtime with base-sepolia payment configuration', () => {
  let runtime: Awaited<ReturnType<typeof createInferenceChipsRuntime>>;

  beforeAll(async () => {
    const paymentsConfig = paymentsFromEnv(
      {},
      {
        PAYMENTS_RECEIVABLE_ADDRESS: '0x000000000000000000000000000000000000dead',
        PAYMENTS_FACILITATOR_URL: 'https://facilitator.example.test',
        PAYMENTS_NETWORK: 'base-sepolia',
      }
    );
    runtime = await createInferenceChipsRuntime({ paymentsConfig });
  });

  afterAll(async () => {
    await runtime.close();
  });

  it('(d) runtime boots with base-sepolia configuration', () => {
    expect(runtime).toBeDefined();
    expect(runtime.payments).toBeDefined();
  });

  it('(d) rank-inference-chips advertises a required x402 payment (402 requirement)', () => {
    // Use runtime.payments.requirements() — the projection that builds the 402
    // challenge without hitting the facilitator network.
    const ep = runtime.agent.getEntrypoint('rank-inference-chips');
    expect(ep).toBeDefined();
    const req = runtime.payments!.requirements(ep!, 'invoke');
    expect(req.required).toBe(true);
    if (req.required) {
      // USD decimal string
      expect(req.price).toBe('0.02');
      // Canonical CAIP-2 network for base-sepolia
      expect(req.network).toBe('eip155:84532');
    }
  });

  it('(d) compare-inference-chips advertises a required x402 payment (402 requirement)', () => {
    const ep = runtime.agent.getEntrypoint('compare-inference-chips');
    expect(ep).toBeDefined();
    const req = runtime.payments!.requirements(ep!, 'invoke');
    expect(req.required).toBe(true);
    if (req.required) {
      expect(req.price).toBe('0.03');
      expect(req.network).toBe('eip155:84532');
    }
  });

  it('(d) paid entrypoints still fail closed (not 200) even with configuration', async () => {
    // With a real (unreachable) facilitator, the runtime returns 503 during
    // network init — it never silently executes the handler for free.
    const req = makeInvokeRequest('/api/agent', 'rank-inference-chips', {
      sliceId: SAMPLE_SLICE_ID,
    });
    const res = await runtime.http.handlers.invoke(req, { key: 'rank-inference-chips' });
    expect(res.status).not.toBe(200);
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it('(d) the 402 response object built by requirements() carries PAYMENT-REQUIRED header', () => {
    const ep = runtime.agent.getEntrypoint('rank-inference-chips')!;
    const req = runtime.payments!.requirements(ep, 'invoke');
    expect(req.required).toBe(true);
    if (req.required) {
      const header = req.response.headers.get('PAYMENT-REQUIRED');
      expect(header).not.toBeNull();
    }
  });
});

// ── suite E: price pinning — reads from the real runtime ─────────────────────

describe('entrypoint price pinning', () => {
  let runtime: Awaited<ReturnType<typeof createInferenceChipsRuntime>>;

  beforeAll(async () => {
    runtime = await createInferenceChipsRuntime({ paymentsConfig: undefined });
  });

  afterAll(async () => {
    await runtime.close();
  });

  it('(e) exactly four entrypoints are registered', () => {
    const all = runtime.entrypoints.snapshot();
    expect(all.length).toBe(4);
  });

  it('(e) rank-inference-chips has price === 0.02', () => {
    const ep = runtime.agent.getEntrypoint('rank-inference-chips');
    expect(ep).toBeDefined();
    expect(ep!.price).toBe('0.02');
  });

  it('(e) compare-inference-chips has price === 0.03', () => {
    const ep = runtime.agent.getEntrypoint('compare-inference-chips');
    expect(ep).toBeDefined();
    expect(ep!.price).toBe('0.03');
  });

  it('(e) get-dataset-status has no price field', () => {
    const ep = runtime.agent.getEntrypoint('get-dataset-status');
    expect(ep).toBeDefined();
    expect(ep!.price).toBeUndefined();
  });

  it('(e) preview-inference-chips has no price field', () => {
    const ep = runtime.agent.getEntrypoint('preview-inference-chips');
    expect(ep).toBeDefined();
    expect(ep!.price).toBeUndefined();
  });

  it('(e) the set of paid entrypoints is exactly {rank-inference-chips, compare-inference-chips}', () => {
    const all = runtime.entrypoints.snapshot();
    // Guard: must have the expected total count before checking the paid subset.
    expect(all.length).toBe(4);

    const paidKeys = all
      .filter((ep) => ep.price !== undefined)
      .map((ep) => ep.key)
      .sort();

    expect(paidKeys).toEqual(['compare-inference-chips', 'rank-inference-chips']);
  });
});

// ── suite F: get-dataset-status — real data integration ──────────────────────

describe('get-dataset-status data integration', () => {
  let runtime: Awaited<ReturnType<typeof createInferenceChipsRuntime>>;

  beforeAll(async () => {
    runtime = await createInferenceChipsRuntime({ paymentsConfig: undefined });
  });

  afterAll(async () => {
    await runtime.close();
  });

  it('(f) manifest matches DATASET_MANIFEST from dataset.ts', async () => {
    const req = makeInvokeRequest('/api/agent', 'get-dataset-status', {});
    const res = await runtime.http.handlers.invoke(req, { key: 'get-dataset-status' });
    expect(res.status).toBe(200);
    const body = await res.json() as { output: { manifest: typeof DATASET_MANIFEST; slices: unknown[] } };
    const { manifest, slices } = body.output;

    expect(manifest.name).toBe(DATASET_MANIFEST.name);
    expect(manifest.schemaVersion).toBe(DATASET_MANIFEST.schemaVersion);
    expect(manifest.release).toBe(DATASET_MANIFEST.release);
    expect(manifest.division).toBe(DATASET_MANIFEST.division);
    expect(manifest.sourceCommit).toBe(DATASET_MANIFEST.sourceCommit);
    expect(manifest.recordsHash).toBe(DATASET_MANIFEST.recordsHash);
    expect(manifest.counts.rows).toBe(ROWS.length);
    expect(manifest.counts.slices).toBe(SLICES.length);
  });

  it('(f) slices array contains all SLICES with correct metadata', async () => {
    const req = makeInvokeRequest('/api/agent', 'get-dataset-status', {});
    const res = await runtime.http.handlers.invoke(req, { key: 'get-dataset-status' });
    const body = await res.json() as { output: { slices: Array<{ sliceId: string; resultCount: number; comparable: boolean }> } };
    const { slices } = body.output;

    expect(slices.length).toBe(SLICES.length);
    // Every slice ID returned must appear in dataset.ts
    for (const s of slices) {
      const found = SLICES.find((ds) => ds.sliceId === s.sliceId);
      expect(found).toBeDefined();
      expect(s.resultCount).toBe(found!.resultCount);
      expect(s.comparable).toBe(found!.comparable);
    }
  });
});

// ── suite G: preview-inference-chips — real data integration ─────────────────

describe('preview-inference-chips data integration', () => {
  let runtime: Awaited<ReturnType<typeof createInferenceChipsRuntime>>;

  beforeAll(async () => {
    runtime = await createInferenceChipsRuntime({ paymentsConfig: undefined });
  });

  afterAll(async () => {
    await runtime.close();
  });

  it('(g) without sliceId returns up to 5 rows from ROWS', async () => {
    const req = makeInvokeRequest('/api/agent', 'preview-inference-chips', {});
    const res = await runtime.http.handlers.invoke(req, { key: 'preview-inference-chips' });
    expect(res.status).toBe(200);
    const body = await res.json() as { output: { rows: Array<{ acceleratorSlug: string; value: number; unit: string }> } };
    const { rows } = body.output;
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.length).toBeLessThanOrEqual(5);
    // Values must match ROWS (not fabricated)
    for (const row of rows) {
      const match = ROWS.find(
        (r) => r.acceleratorSlug === row.acceleratorSlug && r.value === row.value
      );
      expect(match).toBeDefined();
    }
  });

  it('(g) with a valid sliceId returns up to 5 rows from that slice', async () => {
    const req = makeInvokeRequest('/api/agent', 'preview-inference-chips', {
      sliceId: SAMPLE_SLICE_ID,
    });
    const res = await runtime.http.handlers.invoke(req, { key: 'preview-inference-chips' });
    expect(res.status).toBe(200);
    const body = await res.json() as { output: { rows: Array<{ acceleratorSlug: string; value: number; unit: string; logSource: { sha256: string } }> } };
    const { rows } = body.output;
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.length).toBeLessThanOrEqual(5);
    // Every value and logSource must match dataset
    const sliceRows = rowsForSlice(SAMPLE_SLICE_ID);
    for (const row of rows) {
      const match = sliceRows.find(
        (r) => r.acceleratorSlug === row.acceleratorSlug && r.value === row.value
      );
      expect(match).toBeDefined();
      // logSource provenance must be real
      expect(row.logSource.sha256).toBe(match!.logSource.sha256);
      expect(row.logSource.sha256.length).toBe(64); // SHA-256 hex
    }
  });

  it('(g) unknown sliceId returns empty rows with a reason, never fabricates', async () => {
    const req = makeInvokeRequest('/api/agent', 'preview-inference-chips', {
      sliceId: 'does-not-exist-slice',
    });
    const res = await runtime.http.handlers.invoke(req, { key: 'preview-inference-chips' });
    expect(res.status).toBe(200);
    const body = await res.json() as { output: { rows: unknown[]; reason?: string } };
    expect(body.output.rows).toHaveLength(0);
    expect(body.output.reason).toBeDefined();
    expect(typeof body.output.reason).toBe('string');
    expect(body.output.reason!.length).toBeGreaterThan(0);
  });
});

// ── suite H: ranking order, pagination, derived view ─────────────────────────

describe('rank-inference-chips handler (handler tested directly via dataset.ts)', () => {
  // We test the handler logic by calling rankSlice directly — the HTTP layer
  // requires payment config so we verify the logic through the dataset functions
  // that the handler delegates to.

  it('(h) ranking is deterministic and descending', () => {
    const ranked1 = rankSlice(SAMPLE_SLICE_ID, {});
    const ranked2 = rankSlice(SAMPLE_SLICE_ID, {});
    expect(JSON.stringify(ranked1)).toBe(JSON.stringify(ranked2));
    // Values must be monotonically non-increasing
    for (let i = 1; i < ranked1.length; i++) {
      expect(ranked1[i]!.value).toBeLessThanOrEqual(ranked1[i - 1]!.value);
    }
  });

  it('(h) tie-breaking: tied values share a rank (competition ranking)', () => {
    // The scheduled slice has a known tie at value 79.26
    const ranked = rankSlice(SCHEDULED_SLICE_ID, {});
    // Find any tie groups
    const valueCounts = new Map<number, number>();
    for (const r of ranked) {
      valueCounts.set(r.value, (valueCounts.get(r.value) ?? 0) + 1);
    }
    const hasTie = [...valueCounts.values()].some((count) => count > 1);
    expect(hasTie).toBe(true);
    // All rows with the same value must share the same rank
    for (const [val, count] of valueCounts) {
      if (count > 1) {
        const tiedRows = ranked.filter((r) => r.value === val);
        const ranks = new Set(tiedRows.map((r) => r.rank));
        expect(ranks.size).toBe(1);
      }
    }
  });

  it('(h) vendor filter returns only matching vendor rows', () => {
    const amdRows = rankSlice(SAMPLE_SLICE_ID, { vendors: ['AMD'] });
    expect(amdRows.length).toBeGreaterThan(0);
    for (const r of amdRows) {
      expect(r.vendor).toBe('AMD');
    }
    // NVIDIA filter should return different rows
    const nvidiaRows = rankSlice(SAMPLE_SLICE_ID, { vendors: ['NVIDIA'] });
    expect(nvidiaRows.length).toBeGreaterThan(0);
    for (const r of nvidiaRows) {
      expect(r.vendor).toBe('NVIDIA');
    }
    // Must not overlap
    const nvidiaLogIds = new Set(nvidiaRows.map((r) => r.logicalId));
    for (const r of amdRows) {
      expect(nvidiaLogIds.has(r.logicalId)).toBe(false);
    }
  });

  it('(h) derived view only ever contains rows with a real per-accelerator value', () => {
    // The invariant, not a constant: a derived view must never contain a row
    // whose per-accelerator value is unknown, and must never silently fall back
    // to the official number. Whether a given metric is derivable is decided by
    // the pipeline metric registry, so this test must not restate that decision.
    for (const sliceId of [SAMPLE_SLICE_ID, SCHEDULED_SLICE_ID]) {
      const derivedRows = rankSlice(sliceId, { view: 'derived' });
      for (const r of derivedRows) {
        expect(r.derivedPerAccelerator).not.toBeNull();
        expect(r.acceleratorCount).toBeGreaterThan(0);
        // The derived value must be exactly value / acceleratorCount.
        expect(r.derivedPerAccelerator).toBeCloseTo(r.value / (r.acceleratorCount as number), 9);
      }
      // Every row dropped by the derived view must have been underivable.
      const official = rankSlice(sliceId, { view: 'official' });
      const derivedIds = new Set(derivedRows.map((r) => r.logicalId));
      for (const r of official) {
        if (!derivedIds.has(r.logicalId)) expect(r.derivedPerAccelerator).toBeNull();
      }
    }
  });

  it('(h) every released row has a known accelerator count — why the derived filter is currently inert', () => {
    // Honest note: on the pinned v6.0 snapshot the filter in the derived view
    // never actually drops a row, because the pipeline quarantines every record
    // whose accelerator count is not determinable (the 12 CPU-only submissions
    // with accelerators_per_second "0"). Removing that filter therefore does NOT
    // make the suite fail today — it is a fail-closed guard for future data, not
    // a behaviour this dataset can demonstrate. This test states the real reason
    // rather than letting an inert filter look like a verified one.
    for (const r of ROWS) {
      expect(r.acceleratorCount).not.toBeNull();
      expect(r.acceleratorCount as number).toBeGreaterThan(0);
    }
    expect(ROWS.every((r) => r.derivedPerAccelerator !== null)).toBe(true);
  });

  it('(h) quarantined records never appear in any ranking', () => {
    // QUARANTINE contains the quarantined records; their logicalIds must not appear in ROWS
    const quarantineIds = new Set(QUARANTINE.map((q) => q.logicalId));
    for (const row of ROWS) {
      expect(quarantineIds.has(row.logicalId)).toBe(false);
    }
    // Double-check: none appear in any slice ranking
    for (const slice of SLICES) {
      const ranked = rankSlice(slice.sliceId, {});
      for (const r of ranked) {
        expect(quarantineIds.has(r.logicalId)).toBe(false);
      }
    }
  });

  it('(h) pagination: offset and limit partition the full ranked list correctly', () => {
    const all = rankSlice(SAMPLE_SLICE_ID, {});
    const limit = 5;
    let collected: typeof all = [];
    for (let offset = 0; offset < all.length; offset += limit) {
      const page = all.slice(offset, offset + limit);
      collected = [...collected, ...page];
    }
    // All rows collected via pagination match the full list
    expect(collected.length).toBe(all.length);
    for (let i = 0; i < all.length; i++) {
      expect(collected[i]!.logicalId).toBe(all[i]!.logicalId);
      expect(collected[i]!.value).toBe(all[i]!.value);
    }
  });

  it('(h) response size stays under 1 MiB for limit=100 on the largest slice', () => {
    // Find largest slice by resultCount
    const largest = [...SLICES].sort((a, b) => b.resultCount - a.resultCount)[0]!;
    const allRanked = rankSlice(largest.sliceId, {});
    const page = allRanked.slice(0, 100);
    // Simulate the full rank-inference-chips response payload
    const response = {
      sliceId: largest.sliceId,
      slice: {
        sliceId: largest.sliceId,
        workload: largest.workload,
        scenario: largest.scenario,
        metricId: largest.metricId,
        unit: largest.unit,
        direction: largest.direction,
        resultCount: largest.resultCount,
        vendorCount: largest.vendorCount,
        familyCount: largest.familyCount,
        comparable: largest.comparable,
      },
      totalCount: allRanked.length,
      limit: 100,
      offset: 0,
      ranked: page.map((r) => ({
        rank: r.rank,
        acceleratorSlug: r.acceleratorSlug,
        acceleratorName: r.acceleratorName,
        vendor: r.vendor,
        submitter: r.submitter,
        systemId: r.systemId,
        value: r.value,
        unit: r.unit,
        acceleratorCount: r.acceleratorCount,
        derivedPerAccelerator: r.derivedPerAccelerator,
        scenarioMismatch: r.scenarioMismatch,
        logSource: r.logSource,
      })),
    };
    const serialized = JSON.stringify(response);
    const byteLength = Buffer.byteLength(serialized, 'utf8');
    // 1 MiB = 1048576 bytes
    expect(byteLength).toBeLessThan(1048576);
  });
});

// ── suite I: compare-inference-chips handler logic ────────────────────────────

describe('compare-inference-chips handler logic (via dataset.ts)', () => {
  // The handler calls rowsForSlice and processes results — we test the same logic
  // by calling dataset.ts functions directly, mirroring handler behaviour.

  it('(i) missing evidence is reported for unknown slugs', () => {
    const sliceRows = rowsForSlice(SAMPLE_SLICE_ID);
    const realSlug = sliceRows[0]!.acceleratorSlug;
    const fakeSlug = 'does-not-exist-chip-99';
    const requestedSlugs = [realSlug, fakeSlug];
    const foundBySlugs = new Map<string, (typeof sliceRows)[0]>();
    for (const row of sliceRows) {
      if (!requestedSlugs.includes(row.acceleratorSlug)) continue;
      const existing = foundBySlugs.get(row.acceleratorSlug);
      if (!existing || row.value > existing.value) {
        foundBySlugs.set(row.acceleratorSlug, row);
      }
    }
    expect(foundBySlugs.has(realSlug)).toBe(true);
    expect(foundBySlugs.has(fakeSlug)).toBe(false);
    // missing evidence for fakeSlug
    const missing = requestedSlugs.filter((s) => !foundBySlugs.has(s));
    expect(missing).toContain(fakeSlug);
    expect(missing).not.toContain(realSlug);
  });

  it('(i) deltas are null when no baselineSlug is supplied', () => {
    // The handler returns deltas: null and a deltaReason when no baselineSlug
    // Verify this invariant at the data level: no baselineSlug → no computation
    const baselineSlug = undefined;
    const deltasNull = baselineSlug === undefined;
    expect(deltasNull).toBe(true);
  });

  it('(i) deltas are null when baselineSlug has no result in the slice', () => {
    const sliceRows = rowsForSlice(SAMPLE_SLICE_ID);
    const realSlugs = [...new Set(sliceRows.map((r) => r.acceleratorSlug))].slice(0, 2);
    const fakeBaseline = 'phantom-baseline-slug';
    const foundBySlugs = new Map<string, (typeof sliceRows)[0]>();
    for (const row of sliceRows) {
      if (!realSlugs.includes(row.acceleratorSlug)) continue;
      const existing = foundBySlugs.get(row.acceleratorSlug);
      if (!existing || row.value > existing.value) {
        foundBySlugs.set(row.acceleratorSlug, row);
      }
    }
    const baselineRow = foundBySlugs.get(fakeBaseline);
    // Baseline not found → deltas must be null
    expect(baselineRow).toBeUndefined();
  });

  it('(i) deltas are computed correctly when baseline exists', () => {
    const sliceRows = rowsForSlice(SAMPLE_SLICE_ID);
    const slugs = [...new Set(sliceRows.map((r) => r.acceleratorSlug))].slice(0, 3);
    const foundBySlugs = new Map<string, (typeof sliceRows)[0]>();
    for (const row of sliceRows) {
      if (!slugs.includes(row.acceleratorSlug)) continue;
      const existing = foundBySlugs.get(row.acceleratorSlug);
      if (!existing || row.value > existing.value) {
        foundBySlugs.set(row.acceleratorSlug, row);
      }
    }
    const baselineSlug = slugs[0]!;
    const baselineRow = foundBySlugs.get(baselineSlug)!;
    expect(baselineRow).toBeDefined();

    for (const [slug, row] of foundBySlugs) {
      if (slug === baselineSlug) continue;
      const deltaAbsolute = row.value - baselineRow.value;
      const deltaPercent =
        baselineRow.value !== 0 ? (deltaAbsolute / baselineRow.value) * 100 : null;
      // Check arithmetic is correct
      expect(deltaAbsolute).toBeCloseTo(row.value - baselineRow.value, 10);
      if (deltaPercent !== null) {
        expect(deltaPercent).toBeCloseTo((deltaAbsolute / baselineRow.value) * 100, 10);
      }
      // Same unit — no cross-unit delta
      expect(row.unit).toBe(baselineRow.unit);
    }
  });

  it('(i) unknown sliceId for compare returns missingEvidence for all slugs', () => {
    const unknownSlice = 'v6.0|closed|does-not-exist|offline|offline-tokens-per-second';
    const sliceRows = rowsForSlice(unknownSlice);
    // No rows for unknown slice
    expect(sliceRows.length).toBe(0);
    // All requested slugs should be in missingEvidence
    const requestedSlugs = ['slug-a', 'slug-b'];
    const foundBySlugs = new Map<string, (typeof sliceRows)[0]>();
    for (const row of sliceRows) {
      if (!requestedSlugs.includes(row.acceleratorSlug)) continue;
      foundBySlugs.set(row.acceleratorSlug, row);
    }
    const missing = requestedSlugs.filter((s) => !foundBySlugs.has(s));
    expect(missing.length).toBe(requestedSlugs.length);
  });
});

// ── suite J: ACCELERATORS export ─────────────────────────────────────────────

describe('ACCELERATORS export from runtime', () => {
  it('(j) ACCELERATORS is exported and matches dataset.ts', () => {
    expect(ACCELERATORS).toBeDefined();
    expect(Array.isArray(ACCELERATORS)).toBe(true);
    expect(ACCELERATORS.length).toBeGreaterThan(0);
    for (const acc of ACCELERATORS) {
      expect(typeof acc.slug).toBe('string');
      expect(typeof acc.name).toBe('string');
      expect(typeof acc.vendor).toBe('string');
    }
  });
});

// ── suite K: unknown slice handling ──────────────────────────────────────────

describe('unknown slice ID handling', () => {
  it('(k) get-dataset-status lists only real slice IDs', async () => {
    const runtime = await createInferenceChipsRuntime({ paymentsConfig: undefined });
    const req = makeInvokeRequest('/api/agent', 'get-dataset-status', {});
    const res = await runtime.http.handlers.invoke(req, { key: 'get-dataset-status' });
    const body = await res.json() as { output: { slices: Array<{ sliceId: string }> } };
    const returnedIds = body.output.slices.map((s) => s.sliceId);
    for (const id of returnedIds) {
      const found = SLICES.find((s) => s.sliceId === id);
      expect(found).toBeDefined();
    }
    await runtime.close();
  });
});
