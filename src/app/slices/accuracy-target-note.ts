/**
 * Explanation shown in filter bars wherever an accuracy-target control would appear.
 *
 * Why this is a constant and not inline JSX: a second agent is currently verifying
 * whether the accuracy target can be sourced from the upstream data. If it can, only
 * this one line needs to change — no JSX hunt required.
 *
 * Background: MLPerf Inference v6.0 does not encode a separate accuracy-target suffix
 * for the three workloads in scope (llama3.1-8b, gpt-oss-120b, deepseek-r1). Earlier
 * releases used workload-name suffixes such as "llama2-70b-99" / "llama2-70b-99.9", but
 * those splits are absent here. Until the source field is located and confirmed, the
 * Slice definition records accuracyTarget: null rather than invent a value.
 */
export const ACCURACY_TARGET_NOTE =
  'Accuracy-target filter not available: all three workloads in this dataset carry a single implicit accuracy target and the source does not encode it as a separate field. See the Methodology page for detail.';
