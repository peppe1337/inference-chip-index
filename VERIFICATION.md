# Verification report — Inference Chip Index

Every command below was executed in this repository. The outputs are copied verbatim.
Where a check could not be executed, that is stated rather than glossed over.

Environment: Linux, `bun` 1.4.0, Node 22, Next.js 15.5.25.
Source data: `mlcommons/inference_results_v6.0` pinned at commit
`4d3916ac9cf474b679cdfcf492d43a0559418ad1`, clone at `/home/forge/mlperf`.

---

## 1. The standard gates

```
$ bun run type-check
$ tsc --noEmit
(no output, exit 0)

$ bun test
 55 pass
 0 fail
 2155 expect() calls
Ran 55 tests across 2 files.

$ bun run build
✓ Compiled successfully
10 routes built

$ bun run pipeline:verify
Verifying fixture mode...
PASS fixture: 20466f51227a04070371428b45de0d9cca07a3943c394b75e40110e66dccc304
Verifying full-source mode...
PASS full-source: 63fb607eff09c71443caf7a28a43ff1fd2da8bdaef79909e5b9b97d36e708846
All hashes verified. OK.
```

## 2. One endpoint registry, not two

```
$ grep -rn "addEntrypoint" src/
src/agent/runtime.ts:  (4 matches, all in this one file)
```

The Next.js route module at `src/app/api/agent/[[...path]]/route.ts` delegates to
`runtime.http.handlers`. There is no second registry, payment layer, or adapter error
contract.

## 3. Determinism

The pipeline was run twice and the output compared byte for byte:

```
$ sha256sum pipeline-output/full-snapshot.json
4e14c96840fab1e8743f67746b91a6b049f017e321da87f3df011a81f829cab4
$ bun run pipeline:full && sha256sum pipeline-output/full-snapshot.json
4e14c96840fab1e8743f67746b91a6b049f017e321da87f3df011a81f829cab4
```

Identical. The pipeline additionally fails closed on a hash change: a run whose
`recordsHash` differs from `pipeline-output/full-expected-hash.txt` exits non-zero.
That guard fired for real during development (see §5).

## 4. Published numbers checked against the upstream files

A green test proves the code agrees with itself. This check leaves the codebase and
compares what the product publishes against the actual upstream logs on disk — both
the value and the recorded SHA-256.

Top five of slice `v6.0|closed|gpt-oss-120b|server|server-completed-tokens-per-second`:

| Published value | `grep` in the upstream file | Recorded SHA-256 vs `sha256sum` |
|---|---|---|
| 1096765.78 | match | match |
| 1072251.73 | match | match |
| 956522.81 | match | match |
| 900054.32 | match | match |
| 899217.66 | match | match |

Method: read `value`, `logSource.path` and `logSource.sha256` out of the shipped
dataset, then for each one `grep "^Completed tokens per second"` the file at that path
under `/home/forge/mlperf` and `sha256sum` it. Five of five agreed on both fields.

## 5. Red tests — checks that were deliberately broken to see if they go red

A check that has never failed has not been shown to measure anything. Each of these was
broken on purpose, observed, and then reverted.

| # | Injected fault | Expected | Observed |
|---|---|---|---|
| R1 | Removed `price: '0.02'` from the paid `rank-inference-chips` entrypoint — literally the specification's rejection ground "paid endpoints becoming free" | suite must fail | **55 pass → 49 pass / 6 fail** ✅ |
| R2 | Changed the parser output so the record hash no longer matches the pinned expectation | pipeline must refuse | `ERROR: recordsHash mismatch! expected e64b6845… got 63fb607e…`, exit 1 ✅ |
| R3 | Forced one released row to have `acceleratorCount: null` | fact test must fail | **1 fail** ✅ |
| R4 | Requested a non-existent `*.trycloudflare.com` subdomain | must not resolve | `curl` exit 6, HTTP 000 ✅ |
| R5 | Removed the `derivedPerAccelerator !== null` filter from the derived view | suite should fail | **0 fail — the check did NOT go red.** See below. |

### R5 is reported as a failure of the check, not a success

Removing the guard changed nothing, because on this pinned snapshot **every released
record has a known accelerator count**: the pipeline quarantines all 12 CPU-only
submissions (`accelerators_per_node` = `"0"`), which are the only records that could
have an unknown count. The derived-view filter is therefore *inert on this dataset* — a
fail-closed guard for future data, not a behaviour these tests can demonstrate.

Rather than let an untriggerable filter look verified, the test now asserts the actual
reason (`every row has acceleratorCount > 0`), and that assertion **is** red-testable —
that is R3 above.

## 6. Public preview

The application was served and fetched over the public internet, not from localhost.

```
$ cloudflared tunnel --url http://127.0.0.1:8931
https://signing-oct-rock-metadata.trycloudflare.com
```

All pages returned HTTP 200 with their expected content over that public URL, verified
by content markers rather than status code alone:

| Page | Status | Marker found |
|---|---|---|
| `/` | 200 | "fastest verified inference hardware" |
| `/slices` | 200 | `gpt-oss-120b` |
| `/slices/<id>` | 200 | `1,096,765.78` and the pinned-commit source link |
| `/methodology` | 200 | `accelerators_per_node` |
| `/api-docs` | 200 | `402` |
| `/updates` | 200 | `4d3916ac9cf474b679` |
| `/states` | 200 | state index |

### The eight required states

| State | URL | Verified |
|---|---|---|
| Loading | `loading.tsx` at `/`, `/slices`, `/slices/[sliceId]` | Rendered by Next.js during navigation; present in the build output, **not** verifiable by `curl` |
| No comparable results | `/slices/v6.0%7Cclosed%7Cllama3.1-8b%7Coffline%7Coffline-samples-per-second?vendor=AMD` | 200, zero table rows, reason stated |
| Partial evidence | `/slices/v6.0%7Cclosed%7Cdeepseek-r1%7Coffline%7Coffline-samples-per-second` | 200, names the failing condition |
| Invalid filters | `/slices/nonexistent`, `?view=badvalue` | 200, both |
| Stale data | `/states/stale-demo` | 200 |
| Payment required | `/api-docs` | 200, documented 402 body |
| API error | `/api-docs` | 200, documented `invalid_input` body |
| Paid success | `/api-docs` | 200, documented success body |

**Honest limitation.** The payment-required, API-error and paid-success states are
rendered as clearly-labelled *documented examples of API responses*, not live calls. No
payment was made and no facilitator was contacted. They are marked as such on the page.

## 7. A correctness bug found and fixed by this verification

Filtering a slice by a vendor that exists in the dataset but has no result in that exact
slice (for example AMD in `llama3.1-8b` Offline) previously labelled AMD an "unknown
vendor" and then rendered the **full, unfiltered 24-row table**. The user asked a narrow
question and silently received a broader answer.

Now the two cases are distinguished: a known vendor with no evidence in the slice yields
an empty ranking plus the reason; a string that names no vendor at all is reported as an
invalid filter. Measured after the fix:

```
?vendor=AMD        →  0 table rows, "No comparable results"
?vendor=Intel      →  5 table rows
?vendor=Klingonen  →  "matches no vendor in the dataset"
```

## 8. What has NOT been verified

- **The application has not been deployed to Cloudflare Workers.** No Cloudflare account
  exists here and none was created. `wrangler.jsonc` and `open-next.config.ts` are checked
  in, and the OpenNext build (`opennextjs-cloudflare build`) completes locally, producing
  `.open-next/worker.js` and `.open-next/assets`. The deploy step itself was never run.
- **The public preview runs through a Cloudflare Quick Tunnel**, not on Workers. The URL
  is ephemeral, changes whenever the process restarts, and Cloudflare designates Quick
  Tunnels for testing and development only. This is stated rather than dressed up.
- **No mainnet payment was executed.** The x402 payment rail is configured and its 402
  challenge is asserted in tests against a `base-sepolia` configuration, but no real
  payment was settled end to end.
- **Accuracy target** is recorded as `null`. MLPerf v6.0 carries no separate accuracy
  target field for the three workloads in scope, so the field is left empty rather than
  populated with an invented value.
