# Deployment Runbook

## Prerequisites

```sh
export PATH="$HOME/.local/bin:$PATH"
bun install
```

## Local production build and run

### Build

```sh
bun run build
```

This runs `next build` and produces the `.next/` directory. The command succeeds with warnings about a `pino-pretty` optional dependency and a dynamic import expression in a transitive dependency. These are pre-existing warnings in the dependency tree and do not prevent the build from completing.

Observed output on the current codebase:

```
Route (app)                                 Size  First Load JS
┌ ○ /                                      175 B         106 kB
├ ○ /_not-found                            993 B         103 kB
├ ○ /api-docs                              138 B         102 kB
├ ƒ /api/agent/[[...path]]                 138 B         102 kB
├ ○ /methodology                           175 B         106 kB
├ ○ /slices                                175 B         106 kB
├ ƒ /slices/[sliceId]                      175 B         106 kB
├ ○ /states                                175 B         106 kB
├ ○ /states/stale-demo                     175 B         106 kB
└ ○ /updates                               138 B         102 kB
```

### Run

```sh
bun run start
```

The application listens on port **8931**. Open `http://localhost:8931` in a browser.

To run with payment configuration:

```sh
export PAYMENTS_RECEIVABLE_ADDRESS=0xYourWalletAddress
export PAYMENTS_FACILITATOR_URL=https://facilitator.example.com
export PAYMENTS_NETWORK=base-sepolia
bun run start
```

See [PAYMENT_GUIDE.md](PAYMENT_GUIDE.md) for the full list of payment environment variables.

## Public preview via Cloudflare Quick Tunnel

To expose the locally running server to the public internet for testing, use `cloudflared`:

```sh
# In one terminal: start the app
bun run start

# In another terminal: open a tunnel
cloudflared tunnel --url http://127.0.0.1:8931
```

`cloudflared` will print a URL such as `https://random-words.trycloudflare.com`. That URL is publicly accessible for the duration of the tunnel process.

**Important limitations of Quick Tunnels:**

- The URL is ephemeral. It changes every time `cloudflared` restarts.
- Cloudflare designates Quick Tunnels for development and testing only. They are not suitable for production use.
- The tunnel terminates when the `cloudflared` process exits.

This approach was used during development to verify the live site and agent API over a public URL. It has been confirmed to work with the current build.

## Cloudflare Workers deployment

The repository contains configuration for deploying to Cloudflare Workers via `@opennextjs/cloudflare`:

- `open-next.config.ts` — OpenNext Cloudflare adapter, using R2 for incremental cache
- `wrangler.jsonc` — worker name `inference-chip-index`, R2 bucket `inference-chip-index-opennext-cache`, self-reference service binding

The `package.json` scripts are:

```sh
bun run preview:cf   # opennextjs-cloudflare build && wrangler dev
bun run deploy:cf    # opennextjs-cloudflare build && opennextjs-cloudflare deploy
```

**The application has not been deployed to Cloudflare Workers.** The configuration is checked in and represents the intended target, but no Cloudflare account, R2 bucket, or production DNS has been set up for this deliverable. The `preview:cf` and `deploy:cf` scripts have not been run.

A reviewer who wants to deploy would need to:

1. Have a Cloudflare account with Workers and R2 enabled.
2. Create the R2 bucket: `wrangler r2 bucket create inference-chip-index-opennext-cache`
3. Authenticate wrangler: `wrangler login`
4. Run `bun run deploy:cf`

The worker name in `wrangler.jsonc` is `inference-chip-index`. The self-reference service binding (`WORKER_SELF_REFERENCE`) requires that the deployed worker name matches this value exactly, as documented in the wrangler config comments.
