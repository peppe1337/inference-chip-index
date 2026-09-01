# Methodology

## Systems vs chips

MLPerf submissions describe **systems**: a specific number of accelerator boards in a specific server configuration, run by a specific submitter. The Inference Chip Index maps from systems to **chips** (accelerator model names) by reading `accelerator_model_name` from the system JSON and resolving it through the alias registry. The accelerator count is always `accelerators_per_node × number_of_nodes`; it is never inferred from strings in the accelerator name such as `x8`, `Dual`, or `NVL72`.

Multiple systems can carry the same chip. When they appear in the same slice, each system contributes its own row to the ranking.

## Official vs derived metrics

**Official metrics** are the values exactly as logged in `mlperf_log_summary.txt`. These are the numbers MLCommons validates; the Inference Chip Index publishes them without modification.

**Derived (per-accelerator) metrics** are computed as `official_value / accelerator_count`. A derived value is only published when:

1. The metric registry marks the metric as `derivationAllowed: true` (all throughput metrics except `server-scheduled-samples-per-second`, which measures offered load, not delivered work).
2. The accelerator count is a known positive integer (i.e., the record is not quarantined).

`server-scheduled-samples-per-second` has `derivationAllowed: false` in `src/data/dataset.ts` because scheduled rate is the load offered to the system, not the throughput delivered. Dividing it by the accelerator count would produce a number without a valid interpretation.

## Slices

A **slice** is the exact intersection of release, division, workload, scenario, metric, and unit. The slice ID format is:

```
<release>|<division>|<workload>|<scenario_lowercase>|<metricId>
```

Example: `v6.0|closed|llama3.1-8b|offline|offline-tokens-per-second`

Rankings never cross slice boundaries. Comparing `offline-tokens-per-second` from the Offline scenario against `server-completed-tokens-per-second` from the Server scenario would be a semantic error: the workloads differ in latency constraints and what the metric counts. The API enforces slice boundaries: `rank-inference-chips` and `compare-inference-chips` both require an exact slice ID.

There are 24 slices at the pinned commit.

## Comparability bar

A slice is marked **comparable** when it has at minimum:

- 3 or more results
- 2 or more distinct chip vendors (not counting `unknown`)
- 2 or more distinct chip families

10 of the 24 slices meet this bar. Slices that do not meet it are present in the dataset and can be queried, but the API marks them `comparable: false`. A single-vendor slice cannot support a cross-vendor claim.

## Tie handling

When two results in a slice have the same value, they share a rank using competition ranking (the next rank after a tie of N skips N-1 positions). Within a tie group, rows are ordered by logical ID so that repeated calls return byte-identical output.

## Limits of the data

**What the data can support:**

- Ranking accelerators within one exact slice (same workload, scenario, and metric).
- Comparing specific accelerator slugs within one slice, with optional baseline deltas.
- Filtering by chip vendor within a slice.
- Per-accelerator derived values where the metric and count allow it.

**What the data cannot support:**

- Cross-workload rankings. A chip that tops the `deepseek-r1` Offline ranking may not lead on `gpt-oss-120b`.
- Cross-scenario rankings. Offline throughput and Server throughput measure different operating conditions.
- Cross-metric comparisons. `Completed tokens per second` and `Scheduled samples per second` have different semantics.
- Claims about chips not in the dataset. CPU-only submissions are quarantined and absent from all rankings.
- Accuracy claims. The accuracy target field is not present in v6.0 source data for these workloads and is recorded as `null`. See [DATA_SOURCES.md](../DATA_SOURCES.md).
- Inference about future results. The dataset is pinned to one commit of one MLPerf release.

**Known gaps:**

- The `MS-Intel Arc Pro B60 Dual 48G Turbo` accelerator name has not been confirmed identical to the standalone `Intel Arc Pro B60` entry. The alias registry explicitly does not unify them. If they are the same chip, a future alias entry would merge them; until then, they are counted as separate.
- The latency thresholds that distinguish Interactive from Server are not extracted from the source data. The Interactive scenario is recognized by its directory name, not by a latency field comparison.
