import type { Metadata } from 'next';
import Link from 'next/link';
import { DATASET_MANIFEST } from '@/data/dataset';

export const metadata: Metadata = {
  title: 'Stale Data — State Demo',
};

export default function StaleDemoPage() {
  const manifest = DATASET_MANIFEST;

  return (
    <main>
      <div className="container">
        <div className="stack">
          <div>
            <p className="text-muted text-mono" style={{ fontSize: '0.8rem' }}>
              <Link href="/states">States</Link> /
            </p>
            <h1 style={{ marginTop: 'var(--spacing-xs)' }}>Stale data — state demonstration</h1>
            <p className="text-muted gap-top-sm">
              This page demonstrates what the stale-data state looks like. The dataset
              is currently fresh (reviewed 2026-09-01). The banner below is what appears
              on the homepage when the dataset review date exceeds the 90-day freshness
              threshold.
            </p>
          </div>

          <div className="callout callout-info">
            <strong>This is a demonstration.</strong> The stale banner shown below is
            a static replica of what the homepage renders when the freshness threshold
            is crossed. Currently the dataset is fresh.
          </div>

          {/* Simulated stale banner — same markup as homepage uses */}
          <div className="callout callout-warn" role="alert">
            <strong>Stale data:</strong> This dataset was last reviewed more than 90
            days ago. Results may not reflect the current state of hardware availability
            or updated MLPerf rounds.
          </div>

          <div className="provenance-block">
            <div className="provenance">
              <dl>
                <div>
                  <dt>Release</dt>{' '}
                  <dd className="text-mono">{manifest.release}</dd>
                </div>
                <div>
                  <dt>Last reviewed (build date)</dt>{' '}
                  <dd className="text-mono">2026-09-01</dd>
                </div>
                <div>
                  <dt>Simulated current date (demo)</dt>{' '}
                  <dd className="text-mono">2026-12-10</dd>
                </div>
                <div>
                  <dt>Days elapsed (demo)</dt>{' '}
                  <dd className="text-mono">100 (exceeds 90-day threshold)</dd>
                </div>
                <div>
                  <dt>Freshness</dt>{' '}
                  <dd>
                    <span className="badge badge-stale">Stale (demo)</span>
                  </dd>
                </div>
              </dl>
            </div>
          </div>

          <p>
            <Link href="/states">← Back to state index</Link>
          </p>
        </div>
      </div>
    </main>
  );
}
