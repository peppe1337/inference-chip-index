/**
 * Source registry — declares which paths are permitted in the pipeline and why.
 *
 * The path pattern follows the MLCommons inference_results_v6.0 layout:
 *   closed/<submitter>/results/<system_id>/<workload>/<scenario>/performance/run_1/mlperf_log_summary.txt
 *
 * Only the three workloads listed in ALLOWED_WORKLOADS are in scope.
 * The scenario directory name is read from the path, NOT from the log file.
 * (Reason: every Interactive directory contains Scenario: Server in the log.
 * See DATENBEFUND §1.)
 */

export const REPO_REMOTE = 'https://github.com/mlcommons/inference_results_v6.0';
export const PINNED_COMMIT = '4d3916ac9cf474b679cdfcf492d43a0559418ad1';

/**
 * The three workloads in scope.  The underscore variant (llama3_1-8b) is a
 * known alternate spelling that is resolved through the alias registry, not
 * by string manipulation here.
 */
export const ALLOWED_WORKLOADS = [
  'llama3.1-8b',
  'llama3_1-8b',    // alternate spelling — alias registry resolves to llama3.1-8b
  'gpt-oss-120b',
  'deepseek-r1',
] as const;

export type AllowedWorkload = (typeof ALLOWED_WORKLOADS)[number];

/**
 * The division in scope.  Only the closed division is evaluated.
 */
export const ALLOWED_DIVISION = 'closed' as const;

/**
 * Log file name expected inside performance/run_1/.
 */
export const LOG_FILE_NAME = 'mlperf_log_summary.txt';

/**
 * Glob-compatible description of the allowed result path (informational).
 *
 * Pattern:
 *   <division>/<submitter>/results/<system_id>/<workload>/<scenario>/performance/run_1/mlperf_log_summary.txt
 *
 * Exclusion: any path containing a TEST segment (TEST07, TEST09, …) is
 * excluded because those are auxiliary test runs, not primary results.
 */
export const SOURCE_PATH_DESCRIPTION =
  'closed/<submitter>/results/<system_id>/<workload>/<scenario>/performance/run_1/mlperf_log_summary.txt' +
  ' — TEST* sub-directories excluded';

/**
 * Builds the GitHub HTTPS URL for a given relative path inside the repo at
 * the pinned commit.
 */
export function buildGithubUrl(relativePath: string): string {
  return `${REPO_REMOTE}/blob/${PINNED_COMMIT}/${relativePath}`;
}
