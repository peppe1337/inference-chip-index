# Current public preview URL

    https://refer-knowledge-authority-simon.trycloudflare.com

Last verified: 2026-09-03T10:01:47Z — HTTP 200, fetched from the public internet.

This preview is served through a Cloudflare Quick Tunnel. Cloudflare
designates Quick Tunnels for testing and development only, and the address
changes whenever the tunnel process restarts. A watchdog runs every five
minutes: it restarts the app and the tunnel if either is down, verifies the
new address from outside before accepting it, and updates this file.

**This file is the stable pointer — always read the current URL here.**

## Permanent fallback address (no TLS)

    http://167.233.57.1:8931

This is the origin server itself. It does not rotate. If the tunnel address
above is stale when you read this, use it. Measured from 25 independent
check-host.net nodes in about 20 countries on 2026-09-02: 24 of 25 returned
HTTP 200 for `/`, `/slices`, `/methodology`, `/api-docs`, `/updates` and
`/api/agent/health`; one node returned no result. The same probe against the
closed port 8932 failed on 4 of 4 nodes, so the probe does discriminate.
Public reports: `49ad016akcc4`, `49ad0956k83`, `49ad0960k99`, `49ad0963k367`,
`49ad096ck535`, `49ad0970kc9e`, and the negative control `49ad0cb2k4d6`, at
`https://check-host.net/check-report/<id>`.

It is plain HTTP. Ports below 1024 are not bindable for this user, so there is
no Let's Encrypt certificate. Use the tunnel when you need TLS.
