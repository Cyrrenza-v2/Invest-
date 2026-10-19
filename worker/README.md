# Invest Broker Worker API (test-only)

This Worker is a backend foundation, not a production financial ledger or payment processor. The current browser application uses localStorage for its demo authentication and seeded users; those credentials and balances are not a secure backend. This Worker does not trust or reuse that client-side login.

## Routes

- `GET /health` — public liveness check.
- `POST /api/v1/operations` — authenticated, idempotent test-event record.
- `GET /api/v1/operations?accountId=...` — list the latest 100 test events.
- `GET /api/v1/operations/:idempotencyKey?accountId=...` — read one test event.
- `GET /api/v1/summary?accountId=...` — event counts by type.

Protected routes require `Authorization: Bearer <API_TOKEN>`. Set `API_TOKEN` as a Cloudflare Worker secret; never put it in Vite/browser code, GitHub source, or a public variable. Without the secret, protected routes fail closed with HTTP 503.

Every accepted record is marked `mode: "test"`. Amounts are stored as integer minor units. No deposits, withdrawals, investments, payments, provider calls, wallet balance changes, or real-money transfers are executed. This event log must not be presented as an authoritative customer balance.

## Local development

```sh
npm install
npm run worker:dev
npm run test:worker
```

## Deploying

Configure `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, and `INVEST_BROKER_API_TOKEN` as GitHub Actions secrets. The deployment workflow only runs when all three are available. The deploy step installs `INVEST_BROKER_API_TOKEN` as the Worker secret `API_TOKEN`, deploys the Worker, and probes `/health` plus protected-route authentication.

For manual deployment, authenticate Wrangler and run:

```sh
printf '%s' "$INVEST_BROKER_API_TOKEN" | npx wrangler secret put API_TOKEN --config wrangler.jsonc
npm run worker:deploy
```

## Why there is no WebSocket hibernation or alarm yet

The current repository has no backend WebSocket stream, socket session lifecycle, scheduled reconciliation, retry queue, or time-based operation. Adding hibernation or alarms now would be unused complexity. Revisit them only when a concrete live stream or durable scheduled job is introduced.

## Authentication follow-up required

The existing UI's localStorage-based login, seeded user/admin accounts, and client-controlled roles are prototype-only and must not protect real user or admin data. Before connecting this API to the browser app or enabling financial workflows, implement server-verified user sessions and role/permission checks, remove demo credentials, and add an auditable ledger/reconciliation design. The shared API token is for service-to-service bootstrap only, not individual end-user authentication.
