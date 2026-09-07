# The public preview is OFFLINE

**Status 2026-09-07: both addresses below are down, and they are not coming
back.**

    https://quantum-lou-positioning-summer.trycloudflare.com   — dead
    http://167.233.57.1:8931                                   — dead

Measured, not assumed: an off-site fetcher gets `net::ERR_CONNECTION_REFUSED`
on the origin address, and nothing is listening on port 8931 on the host.

## What happened

The preview was a Next.js app behind a Cloudflare Quick Tunnel, kept alive by a
five-minute watchdog. At **2026-09-06T08:05:01Z** the watchdog lost the ability
to rebuild the app (`next: command not found` — the build tool is not on the
watchdog's PATH) and has failed every five minutes since. The preview was
therefore unreachable for about 32 hours before this file was corrected.

The watchdog was removed on 2026-09-07 as part of shutting this work down.
Nothing is left to restart the app.

## Correction to what this file said before

This file previously stated that a watchdog verifies each new address from
outside and keeps this pointer current, and it named both addresses as usable.
**From 2026-09-06T08:05Z onward that was wrong**, and the file kept saying it
for roughly 32 hours. Anyone reading it in that window was sent to two dead
addresses.

Why it went unnoticed is worth recording: a reachability check through the
third-party fetcher `r.jina.ai` returned **HTTP 200 with the full, correct
page** for an address that in fact refuses connections — it served a cached
copy. The same request with a cache-busting query string returns the real
`ERR_CONNECTION_REFUSED`. A cached 200 cannot be told apart from a live one
unless you defeat the cache.

## The content still exists

The site was a view over MLCommons Inference v6.0 results, pinned to source
commit
[`4d3916a`](https://github.com/mlcommons/inference_results_v6.0/tree/4d3916ac9cf474b679cdfcf492d43a0559418ad1).
The application source is in this repository and can be built and run locally.
There is no hosted instance and none is planned.
