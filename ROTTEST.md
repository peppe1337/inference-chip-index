# Rot-Test Protocol

Each mutation was applied, `bun run pipeline:full` (or `bun run pipeline:verify`)
was run, the result checked, and the mutation was reverted before the next test.
All three pipeline rot tests (R5, R6, R7) turned red as required.

The earlier R1–R4 tests (price/entrypoint pinning) are from the previous session
and remain valid.

---

## R1 — remove `price: '0.02'` from `rank-inference-chips`

Mutation: deleted the line `price: '0.02',` from the `rank-inference-chips`
entrypoint.

Result:

```
 11 pass
 6 fail
```

Failing tests included:
- `(e) rank-inference-chips has price === 0.02`
- `(e) the set of paid entrypoints is exactly {rank-inference-chips, compare-inference-chips}`
- `(d) rank-inference-chips advertises a required x402 payment (402 requirement)` (price check inside)
- `(c) rank-inference-chips (paid) is not 200 without payment configuration` (now returns 200, not blocked)

---

## R2 — add `price: '0.01'` to `get-dataset-status`

Mutation: added `price: '0.01',` to the `get-dataset-status` entrypoint.

Result:

```
 14 pass
 3 fail
```

Failing tests included:
- `(e) get-dataset-status has no price field`
- `(e) the set of paid entrypoints is exactly {rank-inference-chips, compare-inference-chips}`
- `(b) get-dataset-status (free) returns 200 with output` (now blocked without payment config)

---

## R3 — remove `compare-inference-chips` entirely

Mutation: deleted the entire `.addEntrypoint({ key: 'compare-inference-chips', ... })`
block from the runtime.

Result:

```
 13 pass
 4 fail
```

Failing tests included:
- `(e) exactly four entrypoints are registered`
- `(e) compare-inference-chips has price === 0.03`
- `(e) the set of paid entrypoints is exactly {rank-inference-chips, compare-inference-chips}`
- `(d) compare-inference-chips advertises a required x402 payment (402 requirement)`

---

## R4 — change `compare-inference-chips` price from `'0.03'` to `'0.30'`

Mutation: changed `price: '0.03'` to `price: '0.30'` on `compare-inference-chips`.

Result:

```
 15 pass
 2 fail
```

Failing tests included:
- `(e) compare-inference-chips has price === 0.03`
- `(d) compare-inference-chips advertises a required x402 payment (402 requirement)` (price check inside)

---

## R5 — modify a source file in the mlperf clone → `pipeline:verify` must fail

File mutated:
`/home/forge/mlperf/closed/AMD/results/8xMI355X_2xEPYC_9575F/gpt-oss-120b/Server/performance/run_1/mlperf_log_summary.txt`

Mutation: appended `\n# R5-test-mutation\n` to the file.

Command run: `bun run pipeline:verify`

Result (exit code 1):

```
Verifying fixture mode...
PASS fixture: 9995177da096e1f578fbe57a544ed9e6091a5c59dca3e884a0814e93f6b547c1
Verifying full-source mode...
FAIL full-source: expected e64b6845ca3397808ef98ea9a0d98de354ca8201e70619a2b06202f92056ccf4, got f5537dbd486734deba2313a498d205f2d79ea7c17028e29b1289ac9fa763e479
Verification FAILED.
```

The fixture hash was unaffected (correct — fixtures are separate copies).
The full-source hash changed because the SHA-256 of the modified file changed,
which changed the contentId of that record, which changed the recordsHash.

Restored: `cd /home/forge/mlperf && git checkout -- closed/AMD/results/8xMI355X_2xEPYC_9575F/gpt-oss-120b/Server/performance/run_1/mlperf_log_summary.txt`

---

## R6 — remove alias entry → accelerator identity count must increase, case must quarantine

Entry removed from `src/pipeline/alias-registry.ts`:
```typescript
{
  raw: 'AMD Instinct MI355X 288GB HBM3e (x94)',
  canonical: 'AMD Instinct MI355X 288GB HBM3e',
  kind: 'accelerator',
  ...
}
```

Command run: `bun run pipeline:full`

Result (exit code 1):

```
Records:     153 released, 14 quarantined
Mismatches:  17 scenario mismatches
recordsHash: a52adf5772562999f6e5641c22784af544157a81bded7f3018d2e7ed688e3667
WARNING: expected 12 quarantined results, got 14
ERROR: recordsHash mismatch!
  expected: e64b6845ca3397808ef98ea9a0d98de354ca8201e70619a2b06202f92056ccf4
  got:      a52adf5772562999f6e5641c22784af544157a81bded7f3018d2e7ed688e3667
```

- Quarantine count: 12 → 14 (the two x94 systems quarantined due to `(x94)` annotation with no alias)
- Distinct accelerator names in coverage matrix (all records): 14 → 15
  (`AMD Instinct MI355X 288GB HBM3e (x94)` appeared as a separate identity)
- Hash changed: verify fails

Restored: the alias entry was un-commented back into the registry.

---

## R7 — read scenario from log instead of path → Interactive results must fall to 0

Mutation in `src/pipeline/parser.ts`:
Changed the scenario resolution line from:
```typescript
const scenarioResolved = resolveAlias(scenarioRaw, 'scenario');
```
to:
```typescript
const _scenarioSource = scenarioInLog ?? scenarioRaw;
const scenarioResolved = resolveAlias(_scenarioSource, 'scenario');
```

Command run: `bun run pipeline:full`

Result (exit code 1):

```
Records:     155 released, 12 quarantined
Mismatches:  0 scenario mismatches
recordsHash: 2822f3685960f32c37bbba7ddee5817ffcd1c1a9f6d79994a2f8120b1150e81b
ERROR: recordsHash mismatch!
  expected: e64b6845ca3397808ef98ea9a0d98de354ca8201e70619a2b06202f92056ccf4
  got:      2822f3685960f32c37bbba7ddee5817ffcd1c1a9f6d79994a2f8120b1150e81b
```

Confirmed via snapshot inspection:
- Interactive results in released records: **0** (was 17)
- Scenario mismatches: **0** (was 17) — because when the log says "Server", no mismatch is detectable

The 17 Interactive results silently merged into the Server category — exactly the
ranking-corruption scenario described in DATENBEFUND §1.

Restored: the parser was reverted to the path-authoritative form.
