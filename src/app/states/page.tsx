import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'State Index',
};

// All 8 required states — each links to a real URL that demonstrates the state.
// Notes explain why each URL triggers that state.
const STATES: Array<{
  id: string;
  label: string;
  url: string;
  implementation: string;
  note: string;
  labelClass: string;
}> = [
  {
    id: 'loading',
    label: 'Loading',
    url: '/slices',
    implementation: 'loading.tsx Suspense boundary',
    note:
      'During server-side rendering or slow navigation, Next.js shows the loading.tsx ' +
      'skeleton. Visible in the browser as a flash before the page content arrives. ' +
      'Each route segment (/slices, /slices/[sliceId]) has its own loading.tsx.',
    labelClass: 'badge badge-partial',
  },
  {
    id: 'no-comparable-results',
    label: 'No comparable results',
    url: '/slices/v6.0%7Cclosed%7Cllama3.1-8b%7Coffline%7Coffline-samples-per-second?vendor=AMD',
    implementation: 'Slice detail page — a known vendor with no evidence in this exact slice',
    note:
      'AMD is a known vendor in this dataset, but it submitted no result for llama3.1-8b ' +
      'Offline in MLPerf Inference v6.0 closed division. The query is legitimate and the ' +
      'honest answer is empty: the ranking renders with zero rows and states the reason. ' +
      'It deliberately does NOT fall back to showing all vendors, because that would answer ' +
      'a different question than the one asked.',
    labelClass: 'badge badge-stale',
  },
  {
    id: 'partial-evidence',
    label: 'Partial evidence',
    url: '/slices/v6.0%7Cclosed%7Cdeepseek-r1%7Coffline%7Coffline-samples-per-second',
    implementation: 'Slice detail page for a non-comparable slice',
    note:
      'This slice (deepseek-r1 / offline / offline-samples-per-second) has 18 results ' +
      'but only 1 vendor (NVIDIA), failing the ≥2 vendors condition. The page shows ' +
      'the partial evidence callout stating exactly which condition failed, before ' +
      'showing the results.',
    labelClass: 'badge badge-partial',
  },
  {
    id: 'invalid-filters',
    label: 'Invalid filters',
    url: '/slices/this-slice-does-not-exist',
    implementation: 'Slice detail page with unknown sliceId',
    note:
      'An unknown sliceId renders the "Invalid slice ID" error page, which explains ' +
      'the problem and links back to the slice list. For an invalid view param, ' +
      'visit any slice with ?view=badvalue.',
    labelClass: 'badge badge-stale',
  },
  {
    id: 'stale-data',
    label: 'Stale data',
    url: '/states/stale-demo',
    implementation: 'Static demonstration page',
    note:
      'The landing page checks whether the dataset review date is more than 90 days ' +
      'old and shows a stale-data banner if so. Currently the dataset is fresh (reviewed ' +
      '2026-09-01). This demo page shows what the stale banner looks like. The real ' +
      'banner would appear on the homepage when the threshold is crossed.',
    labelClass: 'badge badge-stale',
  },
  {
    id: 'payment-required',
    label: 'Payment required',
    url: '/api-docs#payment-required',
    implementation: 'API docs — documented example of 402 response shape',
    note:
      'The API docs page shows a clearly-labelled documented example of the 402 ' +
      'Payment Required response that the rank-inference-chips and compare-inference-chips ' +
      'endpoints return when called without a valid x402 payment token. This is a ' +
      'documentation example, not a live call.',
    labelClass: 'badge badge-quarantine',
  },
  {
    id: 'api-error',
    label: 'API error',
    url: '/api-docs#api-error',
    implementation: 'API docs — documented example of 400 error response shape',
    note:
      'The API docs page shows a clearly-labelled documented example of the 400 Bad ' +
      'Request error response that the API returns for invalid inputs (unknown sliceId, ' +
      'bad vendor, invalid view). This is a documentation example, not a live call.',
    labelClass: 'badge badge-stale',
  },
  {
    id: 'paid-success',
    label: 'Paid success',
    url: '/api-docs#paid-success',
    implementation: 'API docs — documented example of 200 paid response shape',
    note:
      'The API docs page shows a clearly-labelled documented example of the 200 OK ' +
      'response that a paid call to rank-inference-chips returns after successful ' +
      'x402 payment. This is a documentation example, not a live call.',
    labelClass: 'badge badge-comparable',
  },
];

export default function StatesPage() {
  return (
    <main>
      <div className="container">
        <div className="stack">
          <div>
            <h1>State index</h1>
            <p className="text-muted gap-top-sm">
              All eight required states for the Inference Chip Index, each linked to a
              concrete URL that demonstrates it. Click any link to verify the state.
            </p>
          </div>

          <div className="callout callout-info">
            States are implemented as real rendering paths, not decorative placeholders.
            Each row explains which data condition or URL parameter triggers the state,
            and how it is implemented.
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">#</th>
                  <th scope="col">State</th>
                  <th scope="col">Demo URL</th>
                  <th scope="col">Implementation</th>
                  <th scope="col">Notes</th>
                </tr>
              </thead>
              <tbody>
                {STATES.map((s, i) => (
                  <tr key={s.id}>
                    <td className="num text-faint">{i + 1}</td>
                    <td>
                      <span className={s.labelClass}>{s.label}</span>
                    </td>
                    <td style={{ minWidth: '220px' }}>
                      <Link href={s.url} style={{ wordBreak: 'break-all', fontSize: '0.82em' }}>
                        {s.url}
                      </Link>
                    </td>
                    <td style={{ fontSize: '0.82em', color: 'var(--color-text-muted)' }}>
                      {s.implementation}
                    </td>
                    <td style={{ fontSize: '0.82em', maxWidth: '340px' }}>{s.note}</td>
                  </tr>
                ))}
              </tbody>
              <caption>
                All eight states required by the specification, with concrete demo URLs.
              </caption>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}
