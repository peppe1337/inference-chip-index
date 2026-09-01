import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  getSlice,
  rankSlice,
  ACCELERATORS,
  DATASET_MANIFEST,
  METRIC_REGISTRY,
} from '@/data/dataset';

type Props = {
  params: Promise<{ sliceId: string }>;
  searchParams: Promise<{ view?: string; vendor?: string | string[] }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { sliceId } = await params;
  const decoded = decodeURIComponent(sliceId);
  const slice = getSlice(decoded);
  if (!slice) return { title: 'Slice not found' };
  return {
    title: `${slice.workload} / ${slice.scenario} / ${slice.metricId}`,
  };
}

export default async function SliceDetailPage({ params, searchParams }: Props) {
  const { sliceId: rawSliceId } = await params;
  const { view: rawView, vendor: rawVendor } = await searchParams;

  const sliceId = decodeURIComponent(rawSliceId);
  const slice = getSlice(sliceId);

  // Unknown slice → invalid filter state
  if (!slice) {
    return (
      <main>
        <div className="container">
          <div className="stack">
            <div>
              <h1>Invalid slice ID</h1>
              <p className="text-muted gap-top-sm">
                The slice ID <code className="text-mono">{sliceId}</code> does not exist
                in the dataset. Check the URL or browse available slices.
              </p>
            </div>
            <div className="callout callout-error">
              <strong>Invalid filter:</strong> No slice with this ID was found in MLPerf
              Inference {DATASET_MANIFEST.release} closed division. The URL may be
              malformed or out of date.
            </div>
            <p>
              <Link href="/slices">← Back to all slices</Link>
            </p>
          </div>
        </div>
      </main>
    );
  }

  // Validate view param
  const VALID_VIEWS = ['official', 'derived'] as const;
  type View = (typeof VALID_VIEWS)[number];
  const isValidView = (v: string): v is View => VALID_VIEWS.includes(v as View);

  let view: View = 'official';
  let invalidView = false;
  if (rawView !== undefined) {
    if (isValidView(rawView)) {
      view = rawView;
    } else {
      invalidView = true;
    }
  }

  // Validate vendor filter
  const allVendors = [...new Set(
    ACCELERATORS.filter((a) =>
      rankSlice(sliceId).some((r) => r.acceleratorSlug === a.slug)
    ).map((a) => a.vendor)
  )];

  const requestedVendors: string[] = rawVendor
    ? Array.isArray(rawVendor)
      ? rawVendor
      : [rawVendor]
    : [];

  // Two very different situations must not be conflated:
  //  - a vendor that exists in the dataset but has no result in THIS slice
  //    (e.g. AMD in llama3.1-8b Offline) is a legitimate query with an empty
  //    answer — that is "no comparable results", and the honest response is an
  //    empty table plus the reason;
  //  - a string that names no vendor at all is an invalid filter.
  // Collapsing both into "unknown vendor" and then rendering the FULL unfiltered
  // table answered a narrower question than the user asked. That is a silent
  // wrong answer, which for a provenance product is worse than an error.
  const knownVendors = [...new Set(ACCELERATORS.map((a) => a.vendor))];
  const inSlice = (v: string) => allVendors.some((vv) => vv.toLowerCase() === v.toLowerCase());
  const isKnown = (v: string) => knownVendors.some((vv) => vv.toLowerCase() === v.toLowerCase());

  const invalidVendors = requestedVendors.filter((v) => !isKnown(v));
  const vendorsWithoutEvidence = requestedVendors.filter((v) => isKnown(v) && !inSlice(v));
  const activeVendors = requestedVendors.filter((v) => inSlice(v));

  // If every requested vendor is real but absent from this slice, the answer is
  // an empty ranking — never the unfiltered table.
  const emptyByVendorFilter =
    requestedVendors.length > 0 && activeVendors.length === 0 && vendorsWithoutEvidence.length > 0;

  // Get ranked rows
  const rankedRows = emptyByVendorFilter
    ? []
    : rankSlice(sliceId, {
        vendors: activeVendors.length > 0 ? activeVendors : undefined,
        view,
      });

  const metricDef = METRIC_REGISTRY[slice.metricId];

  // Check partial evidence conditions
  const partialReasons: string[] = [];
  if (slice.resultCount < 3)
    partialReasons.push(`only ${slice.resultCount} result${slice.resultCount !== 1 ? 's' : ''} (minimum: 3)`);
  if (slice.vendorCount < 2)
    partialReasons.push(`only ${slice.vendorCount} vendor${slice.vendorCount !== 1 ? 's' : ''} (minimum: 2)`);
  if (slice.familyCount < 2)
    partialReasons.push(`only ${slice.familyCount} chip famil${slice.familyCount !== 1 ? 'ies' : 'y'} (minimum: 2)`);

  // Build filter URLs
  function buildFilterUrl(params: { view?: string; vendors?: string[] }): string {
    const sp = new URLSearchParams();
    const v = params.view ?? view;
    if (v !== 'official') sp.set('view', v);
    const vs = params.vendors ?? activeVendors;
    for (const vendor of vs) sp.append('vendor', vendor);
    const q = sp.toString();
    return `/slices/${encodeURIComponent(sliceId)}${q ? '?' + q : ''}`;
  }

  function toggleVendor(vendor: string): string {
    const next = activeVendors.includes(vendor)
      ? activeVendors.filter((v) => v !== vendor)
      : [...activeVendors, vendor];
    return buildFilterUrl({ vendors: next });
  }

  const commit = DATASET_MANIFEST.sourceCommit;
  const shortCommit = commit.slice(0, 7);
  const repoUrl = DATASET_MANIFEST.sourceRepository;

  return (
    <main>
      <div className="container">
        <div className="stack">
          <div>
            <p className="text-muted text-mono" style={{ fontSize: '0.8rem' }}>
              <Link href="/slices">Slices</Link> /
            </p>
            <h1 style={{ marginTop: 'var(--spacing-xs)' }}>
              {slice.workload} · {slice.scenario} · {slice.metricId}
            </h1>
          </div>

          {/* Invalid filter warnings */}
          {(invalidView || invalidVendors.length > 0) && (
            <div className="callout callout-error" role="alert">
              <strong>Invalid filter parameters:</strong>
              {invalidView && (
                <div>
                  Unknown view <code>{rawView}</code>. Valid values:{' '}
                  <code>official</code>, <code>derived</code>.
                </div>
              )}
              {invalidVendors.length > 0 && (
                <div>
                  Unknown vendor{invalidVendors.length > 1 ? 's' : ''}:{' '}
                  {invalidVendors.map((v) => <code key={v}>{v}</code>)}. This name
                  matches no vendor in the dataset. Known vendors:{' '}
                  {knownVendors.join(', ')}.
                </div>
              )}
              <div style={{ marginTop: 'var(--spacing-xs)' }}>
                Invalid parameters are ignored; showing results with valid filters only.
              </div>
            </div>
          )}

          {/* A real vendor with no evidence in this exact slice — an empty answer,
              not an error and not an excuse to widen the query. */}
          {vendorsWithoutEvidence.length > 0 && (
            <div className="callout callout-warn" role="alert">
              <strong>No comparable results.</strong>{' '}
              {vendorsWithoutEvidence.map((v) => <code key={v}>{v}</code>)}{' '}
              {vendorsWithoutEvidence.length > 1 ? 'are known vendors' : 'is a known vendor'} in
              this dataset, but{' '}
              {vendorsWithoutEvidence.length > 1 ? 'they have' : 'it has'} no valid{' '}
              {DATASET_MANIFEST.release} {DATASET_MANIFEST.division}-division result in this
              exact slice. Vendors present in this slice: {allVendors.join(', ')}. The
              ranking below is intentionally empty — widening it to other vendors would
              answer a different question than the one asked.
            </div>
          )}

          {/* Partial evidence warning */}
          {!slice.comparable && partialReasons.length > 0 && (
            <div className="callout callout-warn" role="alert">
              <strong>Partial evidence.</strong> This slice does not meet the minimum
              threshold for a cross-vendor comparison:{' '}
              {partialReasons.join('; ')}. Results are published for transparency
              but should not be used to rank chips head-to-head across vendors.
            </div>
          )}

          {/* Slice key */}
          <div>
            <div className="section-label">Exact slice key</div>
            <dl className="slice-key">
              <div className="slice-key-item">
                <dt>Release</dt>
                <dd>{slice.release}</dd>
              </div>
              <div className="slice-key-item">
                <dt>Division</dt>
                <dd>{slice.division}</dd>
              </div>
              <div className="slice-key-item">
                <dt>Workload</dt>
                <dd>{slice.workload}</dd>
              </div>
              <div className="slice-key-item">
                <dt>Scenario</dt>
                <dd>{slice.scenario}</dd>
              </div>
              <div className="slice-key-item">
                <dt>Metric</dt>
                <dd>{slice.metricId}</dd>
              </div>
              <div className="slice-key-item">
                <dt>Unit</dt>
                <dd>{slice.unit}</dd>
              </div>
              <div className="slice-key-item">
                <dt>Direction</dt>
                <dd>{slice.direction}</dd>
              </div>
              <div className="slice-key-item">
                <dt>Accuracy target</dt>
                <dd>{slice.accuracyTarget ?? 'not separately encoded in v6.0'}</dd>
              </div>
              <div className="slice-key-item">
                <dt>Comparable</dt>
                <dd>
                  {slice.comparable ? (
                    <span className="badge badge-comparable">Yes</span>
                  ) : (
                    <span className="badge badge-partial">No — partial evidence</span>
                  )}
                </dd>
              </div>
              <div className="slice-key-item">
                <dt>Slice ID</dt>
                <dd style={{ wordBreak: 'break-all' }}>{slice.sliceId}</dd>
              </div>
            </dl>
          </div>

          {/* Filters */}
          <div>
            <div className="section-label">Filters (URL-linkable)</div>
            <div className="filter-row">
              <span>
                <label>View:</label>
              </span>
              <Link
                href={buildFilterUrl({ view: 'official' })}
                className={view === 'official' ? 'active' : ''}
              >
                Official
              </Link>
              {metricDef?.derivationAllowed ? (
                <Link
                  href={buildFilterUrl({ view: 'derived' })}
                  className={view === 'derived' ? 'active' : ''}
                >
                  Per-accelerator (derived)
                </Link>
              ) : (
                <span className="text-faint" style={{ fontSize: '0.8rem' }}>
                  Per-accelerator view not available for this metric
                </span>
              )}

              {allVendors.length > 1 && (
                <>
                  <span style={{ marginLeft: 'var(--spacing-sm)' }}>
                    <label>Vendor:</label>
                  </span>
                  <Link
                    href={buildFilterUrl({ vendors: [] })}
                    className={activeVendors.length === 0 ? 'active' : ''}
                  >
                    All
                  </Link>
                  {allVendors.map((v) => (
                    <Link
                      key={v}
                      href={toggleVendor(v)}
                      className={activeVendors.includes(v) ? 'active' : ''}
                    >
                      {v}
                    </Link>
                  ))}
                </>
              )}
            </div>
          </div>

          {/* Results table or empty state */}
          {rankedRows.length === 0 ? (
            <div>
              <div className="state-empty" role="status">
                <strong>No comparable results</strong>
                <p style={{ marginTop: 'var(--spacing-xs)', color: 'var(--color-text-faint)', fontSize: '0.875rem' }}>
                  {activeVendors.length > 0
                    ? `No results for vendor filter: ${activeVendors.join(', ')}. Try removing the vendor filter.`
                    : view === 'derived'
                    ? 'No derived per-accelerator values available for this slice. Switch to Official view.'
                    : 'This slice has no results.'}
                </p>
                <p style={{ marginTop: 'var(--spacing-sm)' }}>
                  <Link href={`/slices/${encodeURIComponent(sliceId)}`}>
                    Clear all filters →
                  </Link>
                </p>
              </div>
            </div>
          ) : (
            <div>
              <div className="section-label">
                Ranking — {view === 'derived' ? 'per-accelerator (derived)' : 'official value'} ·{' '}
                {rankedRows.length} result{rankedRows.length !== 1 ? 's' : ''}
                {activeVendors.length > 0 ? ` · filtered: ${activeVendors.join(', ')}` : ''}
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Rank</th>
                      <th scope="col">Accelerator</th>
                      <th scope="col">Vendor</th>
                      <th scope="col">System</th>
                      <th scope="col">Submitter</th>
                      <th scope="col">Accel. count</th>
                      <th scope="col">
                        {view === 'derived'
                          ? `Value / accel. (${slice.unit})`
                          : `Value (${slice.unit})`}
                      </th>
                      <th scope="col">Source log</th>
                      <th scope="col">SHA-256</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rankedRows.map((row) => {
                      const displayValue =
                        view === 'derived'
                          ? row.derivedPerAccelerator?.toLocaleString('en-US', {
                              maximumFractionDigits: 2,
                            })
                          : row.value.toLocaleString('en-US', {
                              maximumFractionDigits: 2,
                            });
                      return (
                        <tr key={row.logicalId}>
                          <td className={`rank-cell${row.rank === 1 ? ' rank-1' : ''}`}>
                            {row.rank}
                          </td>
                          <td>{row.acceleratorName}</td>
                          <td>{row.vendor}</td>
                          <td className="text-mono" style={{ fontSize: '0.78em' }}>
                            {row.systemId}
                          </td>
                          <td>{row.submitter}</td>
                          <td className="num">
                            {row.acceleratorCount !== null ? row.acceleratorCount : '—'}
                          </td>
                          <td className="num">{displayValue}</td>
                          <td>
                            <a
                              href={row.logSource.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              title={row.logSource.path}
                              style={{ fontSize: '0.78em' }}
                            >
                              {row.logSource.commit.slice(0, 7)}/…/
                              {row.logSource.path.split('/').slice(-2).join('/')}
                            </a>
                          </td>
                          <td>
                            <span
                              className="text-mono"
                              title={row.logSource.sha256}
                              style={{ fontSize: '0.7em' }}
                            >
                              {row.logSource.sha256.slice(0, 16)}…
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <caption>
                    Ranked by {slice.direction}. Source: MLPerf Inference{' '}
                    {slice.release} {slice.division} ·{' '}
                    <a
                      href={`${repoUrl}/tree/${commit}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      commit {shortCommit}
                    </a>
                    . Each row links to its upstream log file with SHA-256.
                    {view === 'derived' &&
                      ' Derived values = official value ÷ accelerator count; only shown when derivation is allowed and accelerator count is known.'}
                  </caption>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
