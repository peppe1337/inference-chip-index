import type { Metadata } from 'next';
import Link from 'next/link';
import { SLICES, DATASET_MANIFEST } from '@/data/dataset';

export const metadata: Metadata = {
  title: 'Slices',
};

export default function SlicesPage() {
  const manifest = DATASET_MANIFEST;
  const comparable = SLICES.filter((s) => s.comparable);
  const partial = SLICES.filter((s) => !s.comparable);

  return (
    <main>
      <div className="container">
        <div className="stack">
          <div>
            <h1>Slices</h1>
            <p className="gap-top-sm text-muted">
              A slice is one exact combination of release, division, workload, scenario,
              and metric. Rankings only ever compare within a single slice — never across
              workloads or scenarios.
            </p>
          </div>

          <div className="provenance">
            <dl>
              <div>
                <dt>Release</dt> <dd className="text-mono">{manifest.release}</dd>
              </div>
              <div>
                <dt>Division</dt> <dd className="text-mono">{manifest.division}</dd>
              </div>
              <div>
                <dt>Total slices</dt> <dd className="text-mono">{SLICES.length}</dd>
              </div>
              <div>
                <dt>Comparable</dt> <dd className="text-mono">{comparable.length}</dd>
              </div>
            </dl>
          </div>

          {/* Comparable slices */}
          <div>
            <div className="section-label">
              Comparable slices — ≥3 results, ≥2 vendors, ≥2 families
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Workload</th>
                    <th scope="col">Scenario</th>
                    <th scope="col">Metric</th>
                    <th scope="col">Unit</th>
                    <th scope="col">Results</th>
                    <th scope="col">Vendors</th>
                    <th scope="col">Families</th>
                    <th scope="col">Status</th>
                    <th scope="col"></th>
                  </tr>
                </thead>
                <tbody>
                  {comparable.map((slice) => (
                    <tr key={slice.sliceId}>
                      <td className="text-mono">{slice.workload}</td>
                      <td>{slice.scenario}</td>
                      <td className="text-mono">{slice.metricId}</td>
                      <td className="text-mono">{slice.unit}</td>
                      <td className="num">{slice.resultCount}</td>
                      <td className="num">{slice.vendorCount}</td>
                      <td className="num">{slice.familyCount}</td>
                      <td>
                        <span className="badge badge-comparable">Comparable</span>
                      </td>
                      <td>
                        <Link href={`/slices/${encodeURIComponent(slice.sliceId)}`}>
                          Ranking →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <caption>
                  {comparable.length} comparable slices from MLPerf Inference{' '}
                  {manifest.release} closed division.
                </caption>
              </table>
            </div>
          </div>

          {/* Partial-evidence slices */}
          <div>
            <div className="section-label">
              Partial evidence slices — below comparison threshold
            </div>
            <div className="callout callout-warn" style={{ marginBottom: 'var(--spacing-md)' }}>
              These slices have results but do not meet the ≥3 results / ≥2 vendors /
              ≥2 families threshold for a comparable ranking. They are published for
              transparency but should not be used to rank chips head-to-head.
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Workload</th>
                    <th scope="col">Scenario</th>
                    <th scope="col">Metric</th>
                    <th scope="col">Unit</th>
                    <th scope="col">Results</th>
                    <th scope="col">Vendors</th>
                    <th scope="col">Families</th>
                    <th scope="col">Status</th>
                    <th scope="col"></th>
                  </tr>
                </thead>
                <tbody>
                  {partial.map((slice) => {
                    const failedConditions: string[] = [];
                    if (slice.resultCount < 3)
                      failedConditions.push(`only ${slice.resultCount} result${slice.resultCount !== 1 ? 's' : ''} (need ≥3)`);
                    if (slice.vendorCount < 2)
                      failedConditions.push(`only ${slice.vendorCount} vendor${slice.vendorCount !== 1 ? 's' : ''} (need ≥2)`);
                    if (slice.familyCount < 2)
                      failedConditions.push(`only ${slice.familyCount} famil${slice.familyCount !== 1 ? 'ies' : 'y'} (need ≥2)`);
                    return (
                      <tr key={slice.sliceId}>
                        <td className="text-mono">{slice.workload}</td>
                        <td>{slice.scenario}</td>
                        <td className="text-mono">{slice.metricId}</td>
                        <td className="text-mono">{slice.unit}</td>
                        <td className="num">{slice.resultCount}</td>
                        <td className="num">{slice.vendorCount}</td>
                        <td className="num">{slice.familyCount}</td>
                        <td>
                          <span className="badge badge-partial">Partial</span>
                        </td>
                        <td>
                          <Link href={`/slices/${encodeURIComponent(slice.sliceId)}`}>
                            View →
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <caption>
                  {partial.length} partial-evidence slices.
                </caption>
              </table>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
