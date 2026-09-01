import './globals.css';
import type { Metadata } from 'next';
import Link from 'next/link';
import { DATASET_MANIFEST } from '@/data/dataset';

export const metadata: Metadata = {
  title: {
    default: 'Inference Chip Index',
    template: '%s — Inference Chip Index',
  },
  description:
    'Trustworthy, source-linked comparisons of AI inference accelerators from MLPerf Inference v6.0 results.',
};

const NAV = [
  { href: '/', label: 'Home' },
  { href: '/slices', label: 'Slices' },
  { href: '/methodology', label: 'Methodology' },
  { href: '/api-docs', label: 'API' },
  { href: '/updates', label: 'Updates' },
  { href: '/states', label: 'States' },
] as const;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const commit = DATASET_MANIFEST.sourceCommit;
  const shortCommit = commit.slice(0, 7);
  const commitUrl = `${DATASET_MANIFEST.sourceRepository}/tree/${commit}`;

  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <div className="container">
            <Link href="/" className="site-logo">
              Inference Chip Index
            </Link>
            <nav aria-label="Main navigation">
              <ul className="site-nav">
                {NAV.map(({ href, label }) => (
                  <li key={href}>
                    <Link href={href}>{label}</Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </header>
        {children}
        <footer className="site-footer">
          <div className="container">
            <span>
              MLPerf Inference {DATASET_MANIFEST.release} · {DATASET_MANIFEST.division}
            </span>
            <span>
              Source:{' '}
              <a href={commitUrl} target="_blank" rel="noopener noreferrer">
                {shortCommit}
              </a>{' '}
              — data from{' '}
              <a href={DATASET_MANIFEST.sourceRepository} target="_blank" rel="noopener noreferrer">
                mlcommons/inference_results_v6.0
              </a>
            </span>
            <span>No trackers. No external scripts. Server-rendered.</span>
            <span className="site-notice">
              Technical demonstration preview, not a commercial offer. The prices shown
              for the API entrypoints are part of the specification this was built to;
              no payment is accepted, processed or settled by this preview, and no
              personal data is collected. MLPerf® is a trademark of MLCommons®; this is
              an independent presentation of published v6.0 results and is not
              affiliated with or endorsed by MLCommons.
            </span>
          </div>
        </footer>
      </body>
    </html>
  );
}
