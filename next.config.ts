import type { NextConfig } from 'next';

const config: NextConfig = {
  // ESM packages that need transpilation in the Next.js server bundle.
  transpilePackages: [
    '@lucid-agents/core',
    '@lucid-agents/http',
    '@lucid-agents/payments',
    '@lucid-agents/types',
  ],
};

export default config;
