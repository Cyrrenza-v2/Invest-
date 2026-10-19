# Invest Broker — Phase Gate Status
Updated: 2026-10-11
Branch: `feature/platform-foundation`

This is the release gate ledger. A green code/build gate is not the same as authenticated browser end-to-end verification or production financial readiness.

## Permanent app URLs

- Customer: https://invest-broker.vercel.app/
- Admin: https://admin-invest-broker.vercel.app/admin/dashboard

Both domains are verified on the same Vercel project and use host-specific routing. The customer host redirects `/admin`, `/admin/*`, `/admin.html`, and `/admin.webmanifest` to the admin host. The admin host serves the admin shell for its navigation paths and does not serve the customer shell. Customer sessions with the trusted admin role are signed out of the customer app. The admin backend independently enforces JWT, role, MFA/AAL2, active/approved profile, suspension, and primary-admin checks.

## Phase-by-phase status

| Phase | Current status | Evidence / remaining gate |
|---|---|---|
| 1 — Architecture and contracts | **Code gate passed** | Host-isolation, route, PWA manifest and service-worker tests pass in GitHub Actions run 38179899239. Browser navigation is still part of final E2E. |
| 2 — User frontend foundation | **Partial** | Customer screens and routes exist. Full route-by-route mobile, keyboard, loading/error and authenticated browser E2E is not yet verified. |
| 3 — Admin frontend foundation | **Partial** | Separate admin entry, role gate and MFA gate exist. Authenticated admin login, MFA, refresh, and all screen interactions still need browser E2E. |
| 4 — User backend foundation | **Partial** | User API reads and support-message creation exist. Investment requests, deposits, withdrawals, KYC/document workflows and notifications writes remain disabled or incomplete. |
| 5 — Admin backend foundation | **Code gate passed; live auth E2E pending** | Admin API and bootstrap now require gateway JWT validation. Admin authorization unit tests cover missing/stale session, non-admin roles, missing AAL2, suspended/unapproved account, non-primary admin and missing owner assignment. Live authenticated negative endpoint tests remain for final E2E. |
| 6 — Database and ledger | **Posting guard passed; full reconciliation pending** | Posting function deployed. Rollback-only synthetic database tests confirmed balanced USD posting succeeds, unbalanced and mixed-status posting reject, and all test records were rolled back. Live ledger tables currently contain zero ledger transactions, so real reconciliation is not yet demonstrated. |
| 7 — Business engines | **Blocked — prerequisites absent** | Current database has zero investment plans, investments, deposits, withdrawals, ledger transactions and treasury accounts. No payment/payout provider sandbox is configured. Do not invent plan terms, balances, or provider status. |
| 8 — Security hardening | **Partial / not gated yet** | Platform-control RLS now explicitly denies browser roles. Security advisor still warns that leaked-password protection is disabled; enabling it requires a supported Supabase Auth setting/plan. Further review remains. |
| 9 — Frontend/backend connection preparation | **Partial** | Existing read APIs are connected; complete typed contracts and screen-to-API matrix remain. |
| 10 — WebSocket infrastructure | **Not verified** | No complete authorization, replay, deduplication and missed-event recovery test evidence yet. |
| 11 — Connect User frontend to backend | **Partial** | Read paths are connected; broader workflows are not complete. |
| 12 — Connect Admin frontend to backend | **Partial** | Read-only admin routes are connected; full per-route authorization and interaction tests remain. |
| 13 — Real-time events | **Not verified** | Reconnect, replay, duplicate and authorization tests remain. |
| 14 — Financial workflow testing | **Blocked by Phase 7** | No provider-backed deposits, withdrawals or investment lifecycle to test. |
| 15 — End-to-end and operational testing | **Not started** | Requires completed business workflows and final user browser E2E. |
| 16 — Production deployment | **URL routing live; platform release not complete** | Permanent URLs respond correctly. Do not treat that as production financial readiness. Legal/compliance, provider and operational release gates remain. |

## CI and backend evidence

- GitHub Actions: https://github.com/Cyrrenza-v2/Invest-broker/actions/runs/38179899239 — passed.
- The CI job installs dependencies, runs route/host-isolation/PWA and authorization/ledger contract tests, builds both Vite entry points, and verifies both installable-app manifests and assets.
- Supabase `admin-api` version 14 is ACTIVE with `verify_jwt=true`; `admin-bootstrap` version 5 is ACTIVE with `verify_jwt=true`; `user-api` is ACTIVE with `verify_jwt=true`.
- A deny-all client policy was added to `public.platform_control`; service-role Edge Functions remain responsible for platform ownership checks.
- Supabase security advisor currently still reports leaked-password protection disabled.
- CircleCI configuration exists, but a current CircleCI execution has not been independently verified in this run.
- No real money was moved; the ledger validation test used synthetic rows inside a transaction that was rolled back.

## Release rule

Do not mark Phase 7 green until approved investment-plan terms and provider sandbox details are configured and their tests pass. Do not advance the gate to Phase 8 while Phase 7 is blocked. Production deposits, withdrawals, investments and profit credits must remain fail-closed until their own tests and release approvals pass.
