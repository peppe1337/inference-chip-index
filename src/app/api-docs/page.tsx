import type { Metadata } from 'next';
import { DATASET_MANIFEST } from '@/data/dataset';

export const metadata: Metadata = {
  title: 'API Reference',
};

const BASE_URL = 'https://inference-chip-index.example.com';

// Static documented example responses — clearly labelled as documentation, not live calls.

const EXAMPLE_DATASET_STATUS = {
  name: 'Inference Chip Index',
  release: 'v6.0',
  division: 'closed',
  schemaVersion: '1.0.0',
  sourceCommit: '4d3916ac9cf474b679cdfcf492d43a0559418ad1',
  recordsHash: '63fb607eff09c71443caf7a28a43ff1fd2da8bdaef79909e5b9b97d36e708846',
  counts: {
    resultsTotal: 167,
    resultsReleased: 155,
    resultsQuarantined: 12,
    scenarioMismatches: 17,
    rows: 396,
    accelerators: 13,
    slices: 24,
    comparableSlices: 10,
  },
};

const EXAMPLE_PREVIEW = {
  comparableSlices: 10,
  slices: [
    {
      sliceId: 'v6.0|closed|gpt-oss-120b|offline|offline-samples-per-second',
      workload: 'gpt-oss-120b',
      scenario: 'offline',
      metricId: 'offline-samples-per-second',
      unit: 'samples/s',
      resultCount: 28,
      vendorCount: 3,
      familyCount: 6,
      comparable: true,
    },
  ],
  note: 'Full rankings require the rank-inference-chips endpoint.',
};

const EXAMPLE_RANK = {
  sliceId: 'v6.0|closed|gpt-oss-120b|offline|offline-tokens-per-second',
  view: 'official',
  ranked: [
    {
      rank: 1,
      acceleratorName: 'NVIDIA B300 SXM 270GB',
      vendor: 'NVIDIA',
      systemId: 'B300-SXM-270GBx8_TRT',
      submitter: 'NVIDIA',
      acceleratorCount: 8,
      value: 23456.78,
      unit: 'tokens/s',
      logSourceUrl:
        'https://github.com/mlcommons/inference_results_v6.0/blob/4d3916…/closed/NVIDIA/results/…',
      sha256: 'abc123…',
    },
  ],
};

const EXAMPLE_COMPARE = {
  sliceId: 'v6.0|closed|gpt-oss-120b|offline|offline-tokens-per-second',
  view: 'derived',
  accelerators: [
    { acceleratorName: 'NVIDIA B300 SXM 270GB', vendor: 'NVIDIA', rank: 1, valuePerAccelerator: 2931.1 },
    { acceleratorName: 'AMD Instinct MI355X 288GB HBM3e', vendor: 'AMD', rank: 2, valuePerAccelerator: 2100.4 },
  ],
};

const EXAMPLE_PAYMENT_REQUIRED = {
  error: 'payment_required',
  message: 'This endpoint requires a micropayment. See the x402-payment-required header for payment instructions.',
  price: '$0.02',
  endpoint: '/api/agent/rank-inference-chips',
};

const EXAMPLE_API_ERROR = {
  error: 'invalid_input',
  message: 'Unknown sliceId. Use get-dataset-status to list available slices.',
  field: 'sliceId',
};

export default function ApiDocsPage() {
  const manifest = DATASET_MANIFEST;

  return (
    <main>
      <div className="container">
        <div className="stack">
          <div>
            <h1>API Reference</h1>
            <p className="text-muted gap-top-sm">
              Four endpoints expose the Inference Chip Index dataset programmatically.
              Two are free; two require a per-call micropayment using the x402 protocol.
            </p>
          </div>

          <div className="callout callout-info">
            <strong>Base URL:</strong>{' '}
            <code className="text-mono">{BASE_URL}/api/agent/</code>
            <br />
            All requests are HTTP GET or POST (see per-endpoint method). Responses are
            JSON. The dataset reflects MLPerf Inference {manifest.release}{' '}
            {manifest.division} division.
          </div>

          {/* x402 payment flow */}
          <section className="stack">
            <h2>x402 payment flow</h2>
            <p>
              Paid endpoints use the{' '}
              <a
                href="https://github.com/coinbase/x402"
                target="_blank"
                rel="noopener noreferrer"
              >
                x402 micropayment protocol
              </a>
              . The flow is:
            </p>
            <ol style={{ paddingLeft: 'var(--spacing-lg)' }}>
              <li>
                <strong>Discover:</strong> Call the endpoint without payment. Receive{' '}
                <code>402 Payment Required</code> with an{' '}
                <code>x402-payment-required</code> header describing the price and
                accepted payment method.
              </li>
              <li>
                <strong>Pay:</strong> Use a compatible x402 wallet or library to
                authorize the payment on-chain and obtain a payment token.
              </li>
              <li>
                <strong>Invoke:</strong> Repeat the request with the{' '}
                <code>x402-payment</code> header set to the payment token. Receive{' '}
                <code>200 OK</code> with the result.
              </li>
            </ol>
          </section>

          {/* Endpoint 1 */}
          <section className="stack">
            <div className="section-label">Endpoint 1 of 4</div>
            <h2>
              <span className="method-get">GET</span>{' '}
              <code className="text-mono">get-dataset-status</code>{' '}
              <span className="price-badge free">Free</span>
            </h2>
            <p>
              Returns the dataset manifest: release, commit, record counts, and schema
              version. Use this to verify the dataset is current and to enumerate
              available slices.
            </p>
            <h3>Request</h3>
            <pre>{`GET ${BASE_URL}/api/agent/get-dataset-status`}</pre>
            <h3>Response — 200 OK</h3>
            <div className="demo-panel">
              <div className="demo-panel-header">
                Documented example of API response — not a live call
              </div>
              <div className="demo-panel-body">
                <pre>{JSON.stringify(EXAMPLE_DATASET_STATUS, null, 2)}</pre>
              </div>
            </div>
          </section>

          {/* Endpoint 2 */}
          <section className="stack">
            <div className="section-label">Endpoint 2 of 4</div>
            <h2>
              <span className="method-get">GET</span>{' '}
              <code className="text-mono">preview-inference-chips</code>{' '}
              <span className="price-badge free">Free</span>
            </h2>
            <p>
              Returns the list of comparable slices with result counts and metadata.
              Does not return ranked rows — use <code>rank-inference-chips</code> for
              that.
            </p>
            <h3>Request</h3>
            <pre>{`GET ${BASE_URL}/api/agent/preview-inference-chips`}</pre>
            <h3>Response — 200 OK</h3>
            <div className="demo-panel">
              <div className="demo-panel-header">
                Documented example of API response — not a live call
              </div>
              <div className="demo-panel-body">
                <pre>{JSON.stringify(EXAMPLE_PREVIEW, null, 2)}</pre>
              </div>
            </div>
          </section>

          {/* Endpoint 3 */}
          <section className="stack">
            <div className="section-label">Endpoint 3 of 4</div>
            <h2>
              <span className="method-post">POST</span>{' '}
              <code className="text-mono">rank-inference-chips</code>{' '}
              <span className="price-badge">$0.02 per call</span>
            </h2>
            <p>
              Returns the full ranked result table for one exact slice. Supports
              official and derived (per-accelerator) views, and optional vendor
              filtering.
            </p>
            <h3>Request body (JSON)</h3>
            <pre>{JSON.stringify({ sliceId: 'v6.0|closed|gpt-oss-120b|offline|offline-tokens-per-second', view: 'official', vendors: ['NVIDIA', 'AMD'] }, null, 2)}</pre>
            <h4>Fields</h4>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Field</th>
                    <th scope="col">Type</th>
                    <th scope="col">Required</th>
                    <th scope="col">Description</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="text-mono">sliceId</td>
                    <td>string</td>
                    <td>Yes</td>
                    <td>Exact slice ID from the dataset (format: release|division|workload|scenario|metricId)</td>
                  </tr>
                  <tr>
                    <td className="text-mono">view</td>
                    <td><code>official</code> | <code>derived</code></td>
                    <td>No (default: official)</td>
                    <td>Official: system-level value. Derived: official ÷ accelerator count.</td>
                  </tr>
                  <tr>
                    <td className="text-mono">vendors</td>
                    <td>string[]</td>
                    <td>No</td>
                    <td>Filter to specific vendors, e.g. ["NVIDIA", "AMD"]. Omit for all.</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <h3>Errors</h3>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Status</th>
                    <th scope="col">Condition</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><code>402 Payment Required</code></td>
                    <td>No valid x402 payment token provided</td>
                  </tr>
                  <tr>
                    <td><code>400 Bad Request</code></td>
                    <td>Missing or invalid sliceId, unknown vendor, invalid view value</td>
                  </tr>
                  <tr>
                    <td><code>200 OK</code> (empty ranked)</td>
                    <td>Valid slice but no results match the filter combination</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <h3>Documented response shapes</h3>

            <div className="stack-sm">
              <div className="demo-panel">
                <div className="demo-panel-header" style={{ background: 'var(--color-quarantine-bg)', color: 'var(--color-quarantine)' }}>
                  Documented example: 402 Payment Required — x402 discovery response
                </div>
                <div className="demo-panel-body">
                  <pre>{JSON.stringify(EXAMPLE_PAYMENT_REQUIRED, null, 2)}</pre>
                </div>
              </div>

              <div className="demo-panel">
                <div className="demo-panel-header" style={{ background: 'var(--color-error-bg)', color: 'var(--color-error)' }}>
                  Documented example: 400 API Error — invalid input
                </div>
                <div className="demo-panel-body">
                  <pre>{JSON.stringify(EXAMPLE_API_ERROR, null, 2)}</pre>
                </div>
              </div>

              <div className="demo-panel">
                <div className="demo-panel-header" style={{ background: 'var(--color-ok-bg)', color: 'var(--color-ok)' }}>
                  Documented example: 200 Paid Success — ranked result
                </div>
                <div className="demo-panel-body">
                  <pre>{JSON.stringify(EXAMPLE_RANK, null, 2)}</pre>
                </div>
              </div>
            </div>
          </section>

          {/* Endpoint 4 */}
          <section className="stack">
            <div className="section-label">Endpoint 4 of 4</div>
            <h2>
              <span className="method-post">POST</span>{' '}
              <code className="text-mono">compare-inference-chips</code>{' '}
              <span className="price-badge">$0.03 per call</span>
            </h2>
            <p>
              Compares specific accelerators within a slice side-by-side, returning
              their relative ranking and values.
            </p>
            <h3>Request body (JSON)</h3>
            <pre>{JSON.stringify({ sliceId: 'v6.0|closed|gpt-oss-120b|offline|offline-tokens-per-second', accelerators: ['NVIDIA B300 SXM 270GB', 'AMD Instinct MI355X 288GB HBM3e'], view: 'derived' }, null, 2)}</pre>
            <h4>Fields</h4>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Field</th>
                    <th scope="col">Type</th>
                    <th scope="col">Required</th>
                    <th scope="col">Description</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="text-mono">sliceId</td>
                    <td>string</td>
                    <td>Yes</td>
                    <td>Exact slice ID</td>
                  </tr>
                  <tr>
                    <td className="text-mono">accelerators</td>
                    <td>string[]</td>
                    <td>Yes</td>
                    <td>One or more accelerator names to compare (exact match against acceleratorName field)</td>
                  </tr>
                  <tr>
                    <td className="text-mono">view</td>
                    <td><code>official</code> | <code>derived</code></td>
                    <td>No (default: official)</td>
                    <td>Which value to rank by</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <h3>Documented response shapes</h3>

            <div className="stack-sm">
              <div className="demo-panel">
                <div className="demo-panel-header" style={{ background: 'var(--color-quarantine-bg)', color: 'var(--color-quarantine)' }}>
                  Documented example: 402 Payment Required — x402 discovery response
                </div>
                <div className="demo-panel-body">
                  <pre>{JSON.stringify({ ...EXAMPLE_PAYMENT_REQUIRED, price: '$0.03', endpoint: '/api/agent/compare-inference-chips' }, null, 2)}</pre>
                </div>
              </div>

              <div className="demo-panel">
                <div className="demo-panel-header" style={{ background: 'var(--color-error-bg)', color: 'var(--color-error)' }}>
                  Documented example: 400 API Error — invalid input
                </div>
                <div className="demo-panel-body">
                  <pre>{JSON.stringify({ error: 'invalid_input', message: 'Accelerator not found in this slice.', field: 'accelerators' }, null, 2)}</pre>
                </div>
              </div>

              <div className="demo-panel">
                <div className="demo-panel-header" style={{ background: 'var(--color-ok-bg)', color: 'var(--color-ok)' }}>
                  Documented example: 200 Paid Success — comparison result
                </div>
                <div className="demo-panel-body">
                  <pre>{JSON.stringify(EXAMPLE_COMPARE, null, 2)}</pre>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
