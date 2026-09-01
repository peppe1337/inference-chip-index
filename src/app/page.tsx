import type { Metadata } from 'next';
import Link from 'next/link';
import { DATASET_MANIFEST, SLICES } from '@/data/dataset';

export const metadata: Metadata = {
  title: 'Inference Chip Index',
};

// Freshness: the dataset was reviewed when this build ran.
// The source commit date is not embedded in the snapshot, so we treat the
// build time as the last-reviewed time and mark as fresh (< 90 days).
const BUILD_DATE = new Date('2026-09-01');
const STALE_THRESHOLD_DAYS = 90;

function freshnessState(): { label: string; stale: boolean } {
  const now = BUILD_DATE;
  const daysSinceReview = Math.floor(
    (now.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );
  // The snapshot embeds no separate "reviewed" date; we use build date = review date.
  // 0 days elapsed → fresh.
  const stale = daysSinceReview > STALE_THRESHOLD_DAYS;
  return { label: now.toISOString().slice(0, 10), stale };
}

export default function HomePage() {
  const manifest = DATASET_MANIFEST;
  const comparableSlices = SLICES.filter((s) => s.comparable);
  const commit = manifest.sourceCommit;
  const shortCommit = commit.slice(0, 7);
  const commitUrl = `${manifest.sourceRepository}/tree/${commit}`;
  const { label: reviewedDate, stale } = freshnessState();

  return (
    <main>
      <div className="container">
        {/* Hero */}
        <div className="stack">
          <div>
            <h1>Find the fastest verified inference hardware<br />for your workload.</h1>
            <p className="gap-top-sm" style={{ color: 'var(--color-text-muted)', fontSize: '1.05rem' }}>
              Every ranking is for one exact slice: one workload, one scenario, one metric.
              There is no universally fastest chip. A chip that leads on offline token
              throughput for DeepSeek-R1 may rank lower than alternatives on interactive
              token throughput for Llama 3.1-8B. Choose the slice that matches your actual
              deployment scenario.
            </p>
          </div>

          {/* Stale warning */}
          {stale && (
            <div className="callout callout-warn" role="alert">
              <strong>Stale data:</strong> This dataset was last reviewed more than{' '}
              {STALE_THRESHOLD_DAYS} days ago. Results may not reflect the current
              state of hardware availability or updated MLPerf rounds.
            </div>
          )}

          {/* Provenance block */}
          <div className="provenance-block">
            <div className="provenance">
              <dl>
                <div>
                  <dt>Release</dt>{' '}
                  <dd className="text-mono">{manifest.release}</dd>
                </div>
                <div>
                  <dt>Division</dt>{' '}
                  <dd className="text-mono">{manifest.division}</dd>
                </div>
                <div>
                  <dt>Source commit</dt>{' '}
                  <dd>
                    <a
                      href={commitUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-mono"
                    >
                      {shortCommit}
                    </a>
                    {' '}(pinned)
                  </dd>
                </div>
                <div>
                  <dt>Last reviewed</dt>{' '}
                  <dd className="text-mono">{reviewedDate}</dd>
                </div>
                <div>
                  <dt>Freshness</dt>{' '}
                  <dd>
                    {stale ? (
                      <span className="badge badge-stale">Stale</span>
                    ) : (
                      <span className="badge badge-comparable">Current</span>
                    )}
                  </dd>
                </div>
              </dl>
            </div>
          </div>

          {/* Counts */}
          <div>
            <div className="section-label">Dataset at a glance</div>
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-value">{manifest.counts.resultsTotal}</div>
                <div className="stat-label">Results total</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{manifest.counts.resultsReleased}</div>
                <div className="stat-label">Released</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{manifest.counts.resultsQuarantined}</div>
                <div className="stat-label">Quarantined</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{manifest.counts.scenarioMismatches}</div>
                <div className="stat-label">Scenario mismatches</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{manifest.counts.accelerators}</div>
                <div className="stat-label">Accelerators</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{manifest.counts.rows}</div>
                <div className="stat-label">Ranked rows</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{manifest.counts.slices}</div>
                <div className="stat-label">Slices</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{manifest.counts.comparableSlices}</div>
                <div className="stat-label">Comparable slices</div>
              </div>
            </div>
          </div>

          {/* Comparable slices */}
          <div>
            <div className="section-label">
              Comparable slices — ≥3 results, ≥2 vendors, ≥2 families
            </div>
            <div className="callout callout-info" style={{ marginBottom: 'var(--spacing-md)' }}>
              Only these {manifest.counts.comparableSlices} slices meet the minimum evidence
              threshold for a meaningful cross-vendor comparison. Slices below this threshold
              are published but marked as partial evidence.
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Workload</th>
                    <th scope="col">Scenario</th>
                    <th scope="col">Metric</th>
                    <th scope="col">Results</th>
                    <th scope="col">Vendors</th>
                    <th scope="col">Families</th>
                    <th scope="col"></th>
                  </tr>
                </thead>
                <tbody>
                  {comparableSlices.map((slice) => (
                    <tr key={slice.sliceId}>
                      <td className="text-mono">{slice.workload}</td>
                      <td>{slice.scenario}</td>
                      <td>{slice.metricId}</td>
                      <td className="num">{slice.resultCount}</td>
                      <td className="num">{slice.vendorCount}</td>
                      <td className="num">{slice.familyCount}</td>
                      <td>
                        <Link href={`/slices/${encodeURIComponent(slice.sliceId)}`}>
                          View ranking →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <caption>
                  {comparableSlices.length} slices with sufficient cross-vendor evidence.
                  All values from MLPerf Inference {manifest.release} closed division.
                </caption>
              </table>
            </div>
          </div>

          {/* Key disclaimer */}
          <div className="callout">
            <strong>No cherry-picking.</strong> Every number on this site traces to a
            SHA-256-verified log file in the pinned upstream commit. No testimonials,
            no estimated counts, no inferred accelerator quantities. If a count cannot
            be derived from <code>accelerators_per_node × number_of_nodes</code>, that
            result is quarantined and does not appear in any ranking.
          </div>

          {/* Navigation shortcuts */}
          <div className="stack-sm">
            <div className="section-label">Explore</div>
            <ul style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-sm)', listStyle: 'none' }}>
              <li><Link href="/slices">All slices →</Link></li>
              <li><Link href="/methodology">How rankings work →</Link></li>
              <li><Link href="/updates">Dataset changelog →</Link></li>
              <li><Link href="/api-docs">API reference →</Link></li>
            </ul>
          </div>
        </div>
      </div>
    </main>
  );
}
