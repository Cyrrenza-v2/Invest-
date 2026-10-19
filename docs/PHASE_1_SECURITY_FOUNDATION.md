# Phase 1 — Secure foundation

## Scope

This phase establishes and tests the security boundary before connecting customer investment or money-movement actions.

## Implemented in this change

- Added Worker API regression tests for missing and incorrect bearer credentials.
- Added a malformed-payload test that checks rejection occurs before an event is written.
- Preserved the Worker’s explicit test-only mode and its fail-closed behavior when the service token is not configured.
- Kept all financial events as test records; this Worker does not calculate authoritative balances or execute payment rails.

## Existing safeguards confirmed in source

- The Worker protects `/api/v1/*` routes with a server-side `API_TOKEN`; the token is not meant for browser code.
- Operation amounts use integer minor units and input validation.
- SQLite idempotency keys prevent duplicate records; reuse with different operation data returns HTTP 409.
- The Supabase browser client uses a publishable/anon key, not a service-role key. A publishable key is not a substitute for RLS.
- Customer/admin authorization must be enforced by Supabase policies and trusted Edge Functions, not by UI routing or a client-controlled role.

## Blocking items — not represented as passed

1. **Supabase migration reconciliation:** five versions recorded in the live migration history have no recovered original SQL files on the inspected branches. Do not fabricate historical SQL, insert empty placeholders, or reset production migration history. Recover/compare the SQL and test a forward reconciliation against a disposable branch first.
2. **RLS policy audit:** RLS being enabled on a table does not prove that its policies correctly separate customers, administrators, and company treasury. Review policy definitions and test anonymous, customer A, customer B, and admin access with test accounts.
3. **Account approval and role gates:** verify account approval is checked server-side on every protected operation, and only a trusted administrator can approve accounts or change privileged roles.
4. **MFA:** verify the administrator requires an appropriate MFA assurance level server-side, not only a frontend prompt.
5. **Session lifecycle:** the browser client currently stores Supabase access and refresh tokens in localStorage. Test expiry, refresh, logout, revoked sessions, and route re-entry; assess a safer cookie/BFF design before production.
6. **Deployment:** the Cloudflare Worker is not confirmed live. GitHub Actions previously skipped deployment when repository secrets were missing. A green build is not a successful deployment.
7. **Application integration:** the test-only Worker is not yet the authoritative customer ledger and must not be wired to customer balances as if it were one.

## Required secrets

Configure these under GitHub repository Settings → Secrets and variables → Actions:

- `CLOUDFLARE_API_TOKEN` — a narrowly scoped Cloudflare Workers deployment token.
- `CLOUDFLARE_ACCOUNT_ID` — the target Cloudflare account ID.
- `INVEST_BROKER_API_TOKEN` — a strong random service token used as the deployed Worker `API_TOKEN`.

Never commit these values, place them in Vite `VITE_*` variables, or paste them into chat. Cloudflare's official GitHub Actions instructions explain the token and account-ID requirements: https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/

## Acceptance gates before Phase 1 can be called complete

- [ ] Frontend type-check/build passes for customer and admin modes.
- [ ] Worker tests pass, including unauthorized requests, malformed payloads, idempotency, concurrency, and SQLite restart recovery.
- [ ] Supabase migration history and live schema have a reviewed reconciliation plan.
- [ ] RLS/policy tests prove cross-customer isolation and server-side admin-only actions.
- [ ] Account approval and administrator MFA are enforced server-side.
- [ ] Cloudflare deployment is actually performed and live health plus unauthorized-route probes pass.
- [ ] Customer and admin login/session flows are tested with non-production accounts.
- [ ] No real-money or live provider action is enabled.

Phase 1 is complete only when all applicable acceptance gates have evidence. This document records the implementation boundary and outstanding gates; it does not claim that production security or deployment has already passed.
