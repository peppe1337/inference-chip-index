# Payment Guide

## x402 flow

The Inference Chip Index uses the [x402 protocol](https://x402.org/) via the Lucid Agents SDK. The flow for a paid entrypoint is:

1. **Discovery.** Call `get-dataset-status` (free) to list available slice IDs and understand what data is available before paying.
2. **Request.** Send a POST to the paid entrypoint without a payment header.
3. **402 Challenge.** The server responds with HTTP 402 and a `PAYMENT-REQUIRED` header describing the price, network, and facilitator address.
4. **Payment.** The caller constructs and submits a payment transaction on the specified network.
5. **Invocation.** Resend the original request with a valid payment proof header. The server verifies the payment with the facilitator and executes the handler.

## Entrypoints

| Key | Price | Notes |
|---|---|---|
| `get-dataset-status` | Free | No payment required; always returns 200 |
| `preview-inference-chips` | Free | No payment required; always returns 200 |
| `rank-inference-chips` | $0.02 | Requires x402 payment on the configured network |
| `compare-inference-chips` | $0.03 | Requires x402 payment on the configured network |

Without payment configuration the server returns HTTP 503 for paid entrypoints. It never silently executes a paid handler for free: `bun test` includes tests that assert paid endpoints are not reachable (not 200) when no payment config is present.

## Environment variables

The payment rail is configured via environment variables read by `paymentsFromEnv()` from `@lucid-agents/payments`. Set these when running the server:

| Variable | Required | Description |
|---|---|---|
| `PAYMENTS_RECEIVABLE_ADDRESS` | Yes | Wallet address that receives payments (EVM hex address) |
| `PAYMENTS_FACILITATOR_URL` | Yes | URL of the x402 facilitator service |
| `PAYMENTS_NETWORK` | Yes | Network identifier, e.g. `base-sepolia` for testnet |
| `PAYMENTS_FACILITATOR_AUTH` | No | Auth token for the facilitator, if required |

The code in `src/agent/runtime.ts` calls `paymentsFromEnv()` at startup. If `PAYMENTS_RECEIVABLE_ADDRESS` is not set, the payments extension is not initialized and paid entrypoints return 503.

Example for testnet:

```sh
export PAYMENTS_RECEIVABLE_ADDRESS=0xYourWalletAddress
export PAYMENTS_FACILITATOR_URL=https://facilitator.example.com
export PAYMENTS_NETWORK=base-sepolia
bun run start
```

## What has not been done

Mainnet payment configuration and production DNS are out of scope for this deliverable. The environment variables above document what is required when a production operator configures the service; no mainnet addresses or live facilitator URLs are committed to this repository.
