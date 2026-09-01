import type { Metadata } from 'next';
import Link from 'next/link';
import { DATASET_MANIFEST, SCENARIO_MISMATCHES, QUARANTINE } from '@/data/dataset';

export const metadata: Metadata = {
  title: 'Methodology',
};

export default function MethodologyPage() {
  const manifest = DATASET_MANIFEST;

  return (
    <main>
      <div className="container">
        <div className="stack">
          <div>
            <h1>Methodology</h1>
            <p className="text-muted gap-top-sm">
              How results are collected, normalized, and ranked — and what is deliberately
              excluded and why. Every decision below corresponds to a specific pipeline
              rule that can be audited in the source commit.
            </p>
          </div>

          {/* Section 1: Systems vs chips */}
          <section className="stack">
            <h2>1. Systems versus chips</h2>
            <p>
              MLPerf Inference measures <strong>systems</strong> — a specific combination
              of hardware, software, and configuration — not chips in isolation. A system
              description (the <code>.json</code> file alongside each result) records the
              accelerator model, the number of accelerators per node, and the number of
              nodes.
            </p>
            <p>
              This site publishes both the official system-level result and a derived
              per-accelerator value where the metric allows it. The per-accelerator value
              is computed as:
            </p>
            <pre>per_accelerator = official_value ÷ (accelerators_per_node × number_of_nodes)</pre>
            <div className="callout callout-info">
              <strong>Derived values are a convenience — they are not official MLPerf
              results.</strong> They are labelled distinctly and the official value is
              always shown alongside them.
            </div>

            <h3>Accelerator count rule — measured fact (a)</h3>
            <div className="callout callout-warn">
              Accelerator counts come <strong>only</strong> from{' '}
              <code>accelerators_per_node × number_of_nodes</code> as recorded in the
              system description JSON. We never infer a count from strings in the
              accelerator name or system ID — including strings like "x8", "Dual",
              "NVL72", or any other multiplier embedded in a name. Such strings are not
              reliably present or consistently formatted across submitters, and treating
              them as counts would require invention rather than measurement.
            </div>
            <p>
              If both fields are present and numeric, the count is computed. If either
              field is absent, non-numeric, or results in a count of zero, the record
              is quarantined (see Section 4).
            </p>
          </section>

          {/* Section 2: Official vs derived */}
          <section className="stack">
            <h2>2. Official versus derived metrics</h2>
            <p>
              The metric registry governs which metrics exist in this dataset and
              whether per-accelerator derivation is permitted:
            </p>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Metric ID</th>
                    <th scope="col">Label</th>
                    <th scope="col">Unit</th>
                    <th scope="col">Scenarios</th>
                    <th scope="col">Derivation allowed</th>
                    <th scope="col">Reason (if not allowed)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="text-mono">offline-samples-per-second</td>
                    <td>Offline throughput (samples)</td>
                    <td className="text-mono">samples/s</td>
                    <td>Offline</td>
                    <td>Yes</td>
                    <td>—</td>
                  </tr>
                  <tr>
                    <td className="text-mono">offline-tokens-per-second</td>
                    <td>Offline throughput (tokens)</td>
                    <td className="text-mono">tokens/s</td>
                    <td>Offline</td>
                    <td>Yes</td>
                    <td>—</td>
                  </tr>
                  <tr>
                    <td className="text-mono">server-completed-tokens-per-second</td>
                    <td>Completed tokens per second</td>
                    <td className="text-mono">tokens/s</td>
                    <td>Server, Interactive</td>
                    <td>Yes</td>
                    <td>—</td>
                  </tr>
                  <tr>
                    <td className="text-mono">server-completed-samples-per-second</td>
                    <td>Completed samples per second</td>
                    <td className="text-mono">samples/s</td>
                    <td>Server, Interactive</td>
                    <td>Yes</td>
                    <td>—</td>
                  </tr>
                  <tr>
                    <td className="text-mono">server-scheduled-samples-per-second</td>
                    <td>Scheduled samples per second</td>
                    <td className="text-mono">samples/s</td>
                    <td>Server, Interactive</td>
                    <td>No</td>
                    <td>
                      The scheduled rate is an offered load (what the test harness sent),
                      not delivered work. Dividing it by the accelerator count would
                      produce a meaningless figure.
                    </td>
                  </tr>
                </tbody>
                <caption>
                  Metric registry for MLPerf Inference {manifest.release} {manifest.division} division.
                </caption>
              </table>
            </div>
          </section>

          {/* Section 3: Benchmark scenarios */}
          <section className="stack">
            <h2>3. Benchmark scenarios</h2>
            <p>
              MLPerf Inference v6.0 defines three scenarios for the workloads in scope:
            </p>
            <dl style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 'var(--spacing-xs) var(--spacing-md)' }}>
              <dt className="text-mono" style={{ fontWeight: 600 }}>Offline</dt>
              <dd>
                Maximum sustained throughput with batch processing. All requests are
                available at the start; the system processes them as fast as possible.
              </dd>
              <dt className="text-mono" style={{ fontWeight: 600 }}>Server</dt>
              <dd>
                Throughput under a Poisson request arrival process with a 99th-percentile
                latency target. Reflects online serving workloads.
              </dd>
              <dt className="text-mono" style={{ fontWeight: 600 }}>Interactive</dt>
              <dd>
                A newer scenario targeting interactive use cases, with stricter latency
                constraints than the Server scenario.
              </dd>
            </dl>

            <h3>Scenario-mismatch rule — measured fact (b)</h3>
            <div className="callout callout-warn">
              <strong>{SCENARIO_MISMATCHES.length} results</strong> in this dataset have
              a directory path labelled <code>Interactive</code> whose log file records{' '}
              <code>Scenario: Server</code>. This is a known upstream characteristic of
              MLPerf v6.0: the <code>Interactive</code> directory naming convention was
              introduced before the log format was updated to match.
            </div>
            <p>
              The pipeline treats the <strong>directory path as authoritative</strong>.
              These results are assigned the <code>Interactive</code> scenario and are
              valid; only the label source differs. They are <strong>not</strong> mixed
              into the Server ranking. The mismatch is recorded on each affected record
              and listed in the{' '}
              <Link href="/updates#scenario-mismatches">Updates page</Link>.
            </p>

            <h3>Accuracy targets</h3>
            <p>
              MLPerf v6.0 encodes accuracy target levels (99% / 99.9%) in the workload
              name for the three workloads in scope (
              <code>deepseek-r1</code>, <code>gpt-oss-120b</code>,{' '}
              <code>llama3.1-8b</code> / <code>llama3_1-8b</code>). There is no
              separate field in the system or results files. The{' '}
              <code>accuracyTarget</code> field in every slice record is therefore{' '}
              <code>null</code> — we record the absence rather than invent a value.
            </p>
          </section>

          {/* Section 4: Quarantine */}
          <section className="stack">
            <h2>4. Quarantine — measured fact (c)</h2>
            <div className="callout callout-quarantine">
              <strong>{QUARANTINE.length} results</strong> carry{' '}
              <code>accelerators_per_node: "0"</code> in their system description. These
              are CPU-only submissions — the submitter has indicated that no discrete
              accelerator was used. Because the accelerator count is zero, no
              per-accelerator metric can be derived. More importantly, these results
              cannot be meaningfully compared against GPU or other accelerator
              submissions in any ranking.
            </div>
            <p>
              Quarantined results are retained in the dataset for transparency but do
              not appear in any slice ranking. They are listed on the{' '}
              <Link href="/updates#quarantine">Updates page</Link>.
            </p>
          </section>

          {/* Section 5: Comparability */}
          <section className="stack">
            <h2>5. Comparability threshold</h2>
            <p>
              A slice is marked as <strong>comparable</strong> when it meets all three
              conditions simultaneously:
            </p>
            <ul style={{ paddingLeft: 'var(--spacing-lg)' }}>
              <li>
                <strong>≥3 results</strong> — enough data points to make a ranking
                meaningful rather than a single data point.
              </li>
              <li>
                <strong>≥2 distinct vendors</strong> — the ranking is cross-vendor;
                results from a single vendor's multiple systems are not a cross-vendor
                comparison.
              </li>
              <li>
                <strong>≥2 distinct chip families</strong> — prevents a scenario where
                two different system configurations of the same chip model constitute
                "two vendors".
              </li>
            </ul>
            <p>
              Slices below this threshold are published as partial evidence and clearly
              labelled. The threshold is applied at build time from the live dataset;
              no editorial judgment is applied.
            </p>
            <p>
              Currently, <strong>{manifest.counts.comparableSlices} of{' '}
              {manifest.counts.slices} slices</strong> are comparable.
            </p>
          </section>

          {/* Section 6: Source commit */}
          <section className="stack">
            <h2>6. Source commit and reproducibility</h2>
            <p>
              All data derives from a single pinned upstream commit:
            </p>
            <div className="provenance-block">
              <div className="provenance">
                <dl>
                  <div>
                    <dt>Repository</dt>{' '}
                    <dd>
                      <a
                        href={manifest.sourceRepository}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-mono"
                      >
                        mlcommons/inference_results_v6.0
                      </a>
                    </dd>
                  </div>
                  <div>
                    <dt>Commit</dt>{' '}
                    <dd>
                      <a
                        href={`${manifest.sourceRepository}/tree/${manifest.sourceCommit}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-mono"
                      >
                        {manifest.sourceCommit}
                      </a>
                    </dd>
                  </div>
                  <div>
                    <dt>Records hash (SHA-256)</dt>{' '}
                    <dd className="text-mono">{manifest.recordsHash}</dd>
                  </div>
                </dl>
              </div>
            </div>
            <p>
              The records hash is a SHA-256 of the normalised record set. Re-running the
              pipeline from the same commit must produce the same hash; any change would
              indicate a pipeline difference requiring review.
            </p>
            <p>
              Each individual log file in the dataset carries its own SHA-256 (displayed
              in the slice ranking tables). These can be verified against the upstream
              commit independently.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
