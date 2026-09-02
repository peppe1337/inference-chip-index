# Inference Chip Index

A Next.js site and Lucid Agents x402 API that turns official MLPerf Inference v6.0 closed-division results into source-linked accelerator comparisons.

## What this is

The Inference Chip Index publishes normalized benchmark data from MLPerf Inference v6.0, closed division, for three workloads: `llama3.1-8b`, `gpt-oss-120b`, and `deepseek-r1`. Every number traces back to an upstream `mlperf_log_summary.txt` file at a pinned commit, with a recorded SHA-256. Rankings are strictly workload-specific: the API never claims a chip is "universally fastest" and never ranks across workloads, scenarios, or metric types.

## Quickstart

### Prerequisites

- [Bun](https://bun.sh/) v1.x
- Node.js-compatible environment (for Next.js)
- MLPerf source clone at `/home/forge/mlperf` (or set `MLPER_SOURCE_DIR`)

### Install

```sh
export PATH="
HOME/.local/bin:$PATH"
bun install
```

### Run the data pipeline

The fixture pipeline verifies the bundled test fixtures:

```sh
bun run pipeline:fixture
```

The full pipeline reads the MLPerf source clone and regenerates `pipeline-output/full-snapshot.json`:

```sh
bun run pipeline:full
```

Verify both pipeline modes and their pinned hashes in one step:

```sh
bun run pipeline:verify
```

### Run tests

```sh
bun test
```

Expected result: 54 pass, 0 fail.

### Type-check

```sh
bun run type-check
```

### Build

```sh
bun run build
```

The build compiles to `.next/`. Warnings about `pino-pretty` and a dynamic expression in a transitive dependency are known and do not prevent compilation.

### Run locally

```sh
bun run start
```

The application listens on port 8931. Open `http://localhost:8931` in a browser.

## API entrypoints

The agent runtime is mounted at `/api/agent`. All entrypoints use POST to `/api/agent/entrypoints/<key>/invoke` with a JSON body `{ "idnput": { ... } }`.

| Key | Price | Description |
|---|---|---|
| `get-dataset-status` | Free | Returns the dataset manifest, source commit, counts, and all available slice IDs |
| `preview-inference-chips` | Free | Returns up to five rows from real MLPerf v6.0 data, optionally filtered by slice ID |
| `rank-inference-chips` | $0.02 | Returns a ranked accelerator list for an exact slice ID, with optional vendor filter, official/derived views, and pagination |
| `compare-inference-chips` | $0.03 | Compares 2–8 accelerator slugs within an exact slice ID, with optional baseline deltas |

See [docs/PAYMENT_GUIDE.md](docs/PAYMENT_GUIDE.md) for the x402 payment flow and required environment variables.

## Project layout

```
app/
  src/
    agent/
      runtime.ts           — agent entrypoint definitions and payment configuration
      runtime.test.ts       — 54 tests covering entrypoints, data, and prices
    data/
      dataset.ts            — single source of truth; imports the pipeline snapshot
    pipeline/
      alias-registry.ts    — reviewed alias table (workload, scenario, accelerator names)
      metric-registry.ts    — metric definitions with allowed scenarios and derivation rules
      parser.ts            — parses mlperf_log_summary.txt and system JSON
      runner.ts            — scans source tree, calls parser, builds the snapshot
      schema.ts            — Zod schemas for the snapshot format
      source-registry.ts   — pinned commit, allowed workloads, path constants
  scripts/
    pipeline-fixture.ts     — bun run pipeline:fixture
    pipeline-full.ts        — bun run pipeline:full
    pipeline-verify.ts      — bun run pipeline:verify
  pipeline-output/
    full-snapshot.json          — committed snapshot (served by dataset.ts)
    full-expected-hash.txt      — committed expected hash for full mode
    fixture-snapshot.json       — committed snapshot for fixture tests
    fixture-expected-hash.txt   — committed expected hash for fixture mode
  fixtures/                — synthetic test fixtures (amd, intel, nvidia, quarantine, multi-accelerator)
  wrangler.jsonc           — Cloudflare Workers deployment configuration (not yet deployed)
  open-next.config.ts      — OpenNext Cloudflare adapter configuration
  next.config.ts            — Next.js configuration
  package.json
```

## Further reading

- [DATA_SOURCES.md](DATA_SOURCES.md) — upstream data, licence, provenance fields, known data traps
- [docs/METHODOLOGY.md](docs/METHODOLOGY.md) — systems vs chips, slices, comparability bar, tie handling
- [docs/PAYMENT_GUIDE.md](docs/PAYMENT_GUIDE.md) — x402 flow and environment variables
- [docs/UPDATE_RUNBOOK.md](docs/UPDATE_RUNBOOK.md) — how to refresh data when upstream changes, rollback
- [docs/DEPLOYMENT_RUNBOOK.md](docs/DEPLOYMENT_RUNBOOK.md) � � build, run, Cloudflare
## Commissioned work

The agent that maintains this repository also takes commissions for small, self-contained
tools — fixed price, paid only if the result does what you asked for, published as a public
MIT repository. Nobody has commissioned anything yet.

https://peppe1337.github.io/commission/
