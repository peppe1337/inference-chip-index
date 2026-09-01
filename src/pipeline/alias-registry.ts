/**
 * Reviewed alias registry.
 *
 * Every entry here has been manually inspected against the source data.
 * No alias may be added by automated string manipulation — each must be a
 * deliberate, documented decision.
 *
 * Structure:
 *   { raw: string, canonical: string, kind: 'workload'|'scenario'|'accelerator', reason: string }
 *
 * The parser uses resolveAlias() to map raw values to canonical ones.
 * If a raw value is not in this registry and differs from its canonical
 * form, the result is flagged for review.
 */

export type AliasKind = 'workload' | 'scenario' | 'accelerator';

export interface AliasEntry {
  /** The raw string as it appears in the source data. */
  raw: string;
  /** The canonical form used throughout the pipeline. */
  canonical: string;
  kind: AliasKind;
  /** Human-readable rationale — required for every entry. */
  reason: string;
}

/**
 * The complete, reviewed alias table.
 *
 * Rules:
 *  1. Workloads: llama3_1-8b appears with underscore instead of dot.
 *     The canonical name is the one with the dot (as used by the majority
 *     of submitters: 48 directories vs 20).
 *  2. Scenarios: Nebius system nebius_b300_n1 uses all-lowercase "offline"
 *     and "server".  Canonical forms are title-case ("Offline", "Server").
 *  3. Accelerators: AMD submits the same physical accelerator under two
 *     names — with and without the "(x94)" count suffix.  The suffix is a
 *     count annotation, not a model distinction.  Canonical name is without
 *     the suffix.
 *  4. MS-Intel Arc Pro B60 Dual 48G Turbo: this name appears on a card that
 *     uses Intel Arc Pro B60 chips but is NOT confirmed identical to the
 *     standalone "Arc Pro B60" entry.  It is therefore NOT aliased here and
 *     will surface as a distinct entry requiring review.
 */
export const ALIAS_TABLE: ReadonlyArray<AliasEntry> = [
  // ── workload aliases ──────────────────────────────────────────────────────
  {
    raw: 'llama3_1-8b',
    canonical: 'llama3.1-8b',
    kind: 'workload',
    reason:
      'Alternate spelling with underscore instead of dot. ' +
      'Used by 20 directories (vs 48 with the dot). ' +
      'Same model — confirmed by identical benchmark tasks and results structure.',
  },

  // ── scenario aliases ──────────────────────────────────────────────────────
  {
    raw: 'offline',
    canonical: 'Offline',
    kind: 'scenario',
    reason:
      'All-lowercase variant used by Nebius system nebius_b300_n1 (2 directories). ' +
      'All other submitters use title-case "Offline". ' +
      'Same scenario — confirmed by log content.',
  },
  {
    raw: 'server',
    canonical: 'Server',
    kind: 'scenario',
    reason:
      'All-lowercase variant used by Nebius system nebius_b300_n1 (2 directories). ' +
      'All other submitters use title-case "Server". ' +
      'Same scenario — confirmed by log content.',
  },
  // Note: "Interactive" → "Interactive" needs no alias (it is already canonical).

  // ── accelerator aliases ───────────────────────────────────────────────────
  {
    raw: 'AMD Instinct MI355X 288GB HBM3e (x94)',
    canonical: 'AMD Instinct MI355X 288GB HBM3e',
    kind: 'accelerator',
    reason:
      'The "(x94)" suffix is a quantity annotation in the model name field, ' +
      'not a model variant.  System 94xMI355X_24xEPYC_9575F uses 94 GPUs ' +
      '(8 per node × 12 nodes = 96... wait, field says 8 per node × 12 nodes). ' +
      'Reviewed against DATENBEFUND §5: same physical chip as "AMD Instinct MI355X 288GB HBM3e". ' +
      'Accelerator count is always derived from accelerators_per_node × number_of_nodes, ' +
      'never from the name.',
  },
  {
    raw: 'AMD Instinct MI355X 288GB HBM3e (x87)',
    canonical: 'AMD Instinct MI355X 288GB HBM3e',
    kind: 'accelerator',
    reason:
      'The "(x87)" suffix is a quantity annotation in the model name field, ' +
      'not a model variant.  System 87xMI355X_22xEPYC_9575F. ' +
      'Same physical chip as "AMD Instinct MI355X 288GB HBM3e". ' +
      'Accelerator count is always derived from accelerators_per_node × number_of_nodes.',
  },
  // Note on Intel "MS-Intel Arc Pro B60 Dual 48G Turbo":
  //   This is intentionally NOT aliased to "Intel(R) Arc Pro(R) B60".
  //   Whether these are the same silicon requires a product-identity decision
  //   that has not been made.  The pipeline will surface it as a review case.
];

/** Index for O(1) lookup. */
const _byRaw = new Map<string, AliasEntry>(ALIAS_TABLE.map((e) => [e.raw, e]));

/**
 * Returns the canonical form of a raw value, or the raw value itself if no
 * alias exists.
 *
 * Also returns whether an alias was applied, so callers can record the
 * provenance.
 */
export function resolveAlias(
  raw: string,
  kind: AliasKind
): { canonical: string; aliasApplied: boolean; entry: AliasEntry | null } {
  const entry = _byRaw.get(raw);
  if (entry && entry.kind === kind) {
    return { canonical: entry.canonical, aliasApplied: true, entry };
  }
  return { canonical: raw, aliasApplied: false, entry: null };
}
