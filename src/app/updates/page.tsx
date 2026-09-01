import type { Metadata } from 'next';
import { DATASET_MANIFEST, QUARANTINE, SCENARIO_MISMATCHES } from '@/data/dataset';

export const metadata: Metadata = {
  title: 'Updates',
};

export default function UpdatesPage() {
  const manifest = DATASET_MANIFEST;
  const commit = manifest.sourceCommit;
  const shortCommit = commit.slice(0, 7);
  const commitUrl = `${manifest.sourceRepository}/tree/${commit}`;

  return (
    <main>
      <div className="container">
        <div className="stack">
          <div>
            <h1>Updates</h1>
            <p className="text-muted gap-top-sm">
              Dataset manifest, changelog, and evidence lists. Everything here is derived
              directly from the pipeline output — no editorial additions.
            </p>
          </div>

          {/* Manifest */}
          <section className="stack">
            <h2>Dataset manifest</h2>
            <div className="provenance-block">
              <div className="provenance">
                <dl>
                  <div>
                    <dt>Name</dt> <dd>{manifest.name}</dd>
                  </div>
                  <div>
                    <dt>Release</dt> <dd className="text-mono">{manifest.release}</dd>
                  </div>
                  <div>
                    <dt>Division</dt> <dd className="text-mono">{manifest.division}</dd>
                  </div>
                  <div>
                    <dt>Schema version</dt>{' '}
                    <dd className="text-mono">{manifest.schemaVersion}</dd>
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
                      </a>{' '}
                      (
                      <a
                        href={commitUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-mono"
                        style={{ fontSize: '0.85em' }}
                      >
                        {commit}
                      </a>
                      )
                    </dd>
                  </div>
                  <div>
                    <dt>Records hash (SHA-256)</dt>{' '}
                    <dd className="text-mono">{manifest.recordsHash}</dd>
                  </div>
                </dl>
              </div>
            </div>

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
                <div className="stat-value">{manifest.counts.rows}</div>
                <div className="stat-label">Ranked rows</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{manifest.counts.accelerators}</div>
                <div className="stat-label">Accelerators</div>
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
          </section>

          {/* Changelog */}
          <section className="stack">
            <h2>Changelog</h2>
            <div className="changelog-entry">
              <p className="text-mono text-muted" style={{ fontSize: '0.8rem' }}>
                2026-09-01
              </p>
              <h3>Initial publication — MLPerf Inference v6.0</h3>
              <p>
                First public release of the Inference Chip Index. Data covers MLPerf
                Inference v6.0 closed division, pinned to commit{' '}
                <a href={commitUrl} target="_blank" rel="noopener noreferrer" className="text-mono">
                  {shortCommit}
                </a>
                .
              </p>
              <ul style={{ paddingLeft: 'var(--spacing-lg)', marginTop: 'var(--spacing-sm)' }}>
                <li>
                  {manifest.counts.resultsReleased} results published across{' '}
                  {manifest.counts.slices} slices
                </li>
                <li>
                  {manifest.counts.resultsQuarantined} CPU-only results quarantined (
                  <code>accelerators_per_node: "0"</code>)
                </li>
                <li>
                  {manifest.counts.scenarioMismatches} scenario mismatches recorded (
                  Interactive directory / Server log label — see below)
                </li>
                <li>
                  {manifest.counts.comparableSlices} comparable slices identified
                </li>
              </ul>
            </div>
          </section>

          {/* Quarantine list */}
          <section className="stack" id="quarantine">
            <h2>
              Quarantine list — {QUARANTINE.length} results
            </h2>
            <div className="callout callout-quarantine">
              These {QUARANTINE.length} results carry{' '}
              <code>accelerators_per_node: "0"</code> in their system description,
              indicating a CPU-only submission. They cannot appear in any chip ranking.
              Each entry links to its upstream source file.
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Logical ID</th>
                    <th scope="col">Submitter</th>
                    <th scope="col">System ID</th>
                    <th scope="col">Workload</th>
                    <th scope="col">Scenario</th>
                    <th scope="col">Reason</th>
                    <th scope="col">Source</th>
                  </tr>
                </thead>
                <tbody>
                  {QUARANTINE.map((q) => {
                    const reasons = (q as { reasons?: string[] }).reasons ?? [];
                    return (
                      <tr key={q.logicalId}>
                        <td className="text-mono" style={{ fontSize: '0.78em' }}>
                          {q.logicalId}
                        </td>
                        <td>{q.submitter}</td>
                        <td className="text-mono" style={{ fontSize: '0.78em' }}>
                          {q.systemId}
                        </td>
                        <td className="text-mono">{q.workload}</td>
                        <td>{q.scenario}</td>
                        <td style={{ fontSize: '0.8em' }}>
                          {reasons.join('; ')}
                        </td>
                        <td>
                          <a
                            href={q.logSource.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ fontSize: '0.78em' }}
                          >
                            log
                          </a>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <caption>
                  {QUARANTINE.length} quarantined records. None appear in any ranking.
                </caption>
              </table>
            </div>
          </section>

          {/* Scenario mismatch list */}
          <section className="stack" id="scenario-mismatches">
            <h2>
              Scenario mismatch list — {SCENARIO_MISMATCHES.length} results
            </h2>
            <div className="callout callout-warn">
              These {SCENARIO_MISMATCHES.length} results have a directory path labelled{' '}
              <code>Interactive</code> but their log file records{' '}
              <code>Scenario: Server</code>. This is a known characteristic of MLPerf
              v6.0: the pipeline treats the directory path as authoritative and assigns
              them the Interactive scenario. They are <strong>not</strong> included in
              Server-scenario rankings.
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Logical ID</th>
                    <th scope="col">Submitter</th>
                    <th scope="col">Workload</th>
                    <th scope="col">Path scenario</th>
                    <th scope="col">Log scenario</th>
                    <th scope="col">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {SCENARIO_MISMATCHES.map((m) => (
                    <tr key={m.logicalId}>
                      <td className="text-mono" style={{ fontSize: '0.78em' }}>
                        {m.logicalId}
                      </td>
                      <td>{m.submitter}</td>
                      <td className="text-mono">{m.workload}</td>
                      <td className="text-mono">{m.scenarioFromPath}</td>
                      <td className="text-mono">{m.scenarioInLog}</td>
                      <td style={{ fontSize: '0.8em' }}>{m.note}</td>
                    </tr>
                  ))}
                </tbody>
                <caption>
                  {SCENARIO_MISMATCHES.length} records with Interactive/Server scenario
                  mismatch. All are valid and ranked under Interactive.
                </caption>
              </table>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
