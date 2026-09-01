# Data Sources

## Upstream repository

| Field | Value |
|---|---|
| Repository | `https://github.com/mlcommons/inference_results_v6.0` |
| Pinned commit | `4d3916ac9cf474b679cdfcf492d43a0559418ad1` |
| Local clone | `/home/forge/mlperf` (default; override with `MLPERF_SOURCE_DIR`) |

The pipeline reads only the pinned commit. The hash guard in `pipeline-output/full-expected-hash.txt` (`63fb607eff09c71443caf7a28a43ff1fd2da8bdaef79909e5b9b97d36e708846`) ensures that a re-run against a different commit or a modified file will fail rather than silently produce different output.

## Licence and attribution

MLPerf Inference v6.0 results are published by MLCommons under the [MLCommons licence](https://github.com/mlcommons/inference_results_v6.0/blob/main/LICENSE.md). The Inference Chip Index normalizes and re-publishes this data with source links back to the original files. All derived rankings link to the specific log file and system description from which they were extracted.

## Scope

- **Division:** closed only
- **Workloads:** `llama3.1-8b`, `gpt-oss-120b`, `deepseek-r1`
- **Alternate workload spelling ingested:** `llama3_1-8b` (resolved to `llama3.1-8b` by the alias registry)
- **Scenarios:** Offline, Server, Interactive
- **Result path pattern:**
  ```
  closed/<submitter>/results/<system_id>/<workload>/<scenario>/performance/run_1/mlperf_log_summary.txt
  ```
- **System description path:**
  ```
  closed/<submitter>/systems/<system_id>.json
  ```
- **Exclusions:** any path segment starting with `TEST` (test runs, not primary results)

## Counts at the pinned commit

| Metric | Count |
|---|---|
| Result directories in scope | 167 |
| Released (published) records | 155 |
| Quarantined (review-required) records | 12 |
| Scenario mismatches (Interactive/Server) | 17 |
| Dataset rows (metric-level) | 396 |
| Distinct accelerators (after alias resolution) | 13 |
| Slices | 24 |
| Comparable slices | 10 |

## Provenance fields recorded per record

Every published record carries source citations for both the log file and the system description:

| Field | Description |
|---|---|
| `repository` | `https://github.com/mlcommons/inference_results_v6.0` |
| `commit` | `4d3916ac9cf474b679cdfcf492d43a0559418ad1` |
| `path` | Path relative to the repository root |
| `url` | Direct GitHub HTTPS link at the pinned commit |
| `sha256` | SHA-256 hex digest of the file bytes |

The `sha256` field is computed at parse time from the raw file bytes. A modified file will produce a different hash, which changes the record's `contentId`, which changes the top-level `recordsHash`, which causes `pipeline:verify` to fail.

## Accuracy target

The three workloads in scope (`llama3.1-8b`, `gpt-oss-120b`, `deepseek-r1`) do not carry a 99/99.9 accuracy suffix in their directory names, unlike earlier MLPerf workloads such as `llama2-70b-99`. No separate accuracy-target field is present in the v6.0 system descriptions or measurement files for these workloads. The `accuracyTarget` field is therefore recorded as `null` throughout the dataset rather than inventing a value.

## Known data traps

These are measured findings from the source data at the pinned commit. Each is handled explicitly by the pipeline, not silently absorbed.

### Trap 1: Interactive directories log `Scenario : Server`

All 17 `Interactive` scenario directories contain `Scenario : Server` in their `mlperf_log_summary.txt`. Interactive is a Server-mode run with a tighter latency constraint; LoadGen records it as `Server`.

A parser that reads the scenario from the log file would silently merge Interactive into the Server ranking. The pipeline reads the scenario from the **directory path**, which is authoritative. The log value is recorded separately as `scenarioInLog`, and the mismatch is flagged in the scenario mismatch report.

### Trap 2: Two spellings of the same workload

`llama3.1-8b` (48 directories) and `llama3_1-8b` (20 directories) are the same workload, differing only in dot vs underscore. This is resolved by the reviewed alias registry in `src/pipeline/alias-registry.ts`, not by a `replace('_', '.')` call in the parser. An automatic string manipulation would not be auditable; every alias entry carries a documented rationale.

### Trap 3: Nebius lowercase scenario names

The Nebius system `nebius_b300_n1` writes `offline` and `server` in all lowercase; all other submitters use title case (`Offline`, `Server`). These are resolved by the alias registry. The fact that the source deviated from convention is preserved in the `scenarioRaw` field.

### Trap 4: CPU-only submissions with `accelerators_per_node: "0"` (string)

Twelve submissions carry `accelerators_per_node` as the **string** `"0"`, not the number `0`. These are CPU-only submissions (Intel Granite Rapids Xeon systems from Cisco, Dell, Intel, and Lenovo) with no GPU accelerator. A `typeof value === 'number'` check would pass `"0"` through, producing a division-by-zero or a meaningless per-accelerator metric.

The parser coerces both `accelerators_per_node` and `number_of_nodes` to numbers explicitly, then quarantines any record where `accelerators_per_node === 0`. These 12 records appear in the quarantine report and never reach a ranking.

### Trap 5: Accelerator count embedded in model name — do not read it

`AMD Instinct MI355X 288GB HBM3e` and `AMD Instinct MI355X 288GB HBM3e (x94)` are the same physical accelerator. The `(x94)` suffix is a quantity annotation in the model name field, not a model variant.

The accelerator count comes **only** from `accelerators_per_node × number_of_nodes`. The two names are unified by an alias registry entry. The count in the name is not only prohibited by the pipeline rules — it is demonstrably wrong: the system with `(x94)` in its name reports `accelerators_per_node: "8"` and `number_of_nodes: "12"`, giving 96 accelerators, not 94.

### Trap 6: Duplicate log key in v6.0 summaries

MLPerf v6.0 log summaries print `Completed tokens per second` **twice**. The two lines differ only in whitespace padding. Measured across all 284 in-scope summary files: this is the only repeated key, it appears in 154 files, and in every case the two values are identical.

The parser collapses exact repeats (same metric ID, same value, same unit) into a single record. A repeat where the two values **differ** quarantines the record rather than silently picking one value, because choosing would be a fabrication.
