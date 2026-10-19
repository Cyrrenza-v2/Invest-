# Invest Broker — Master Full-Stack Build Plan
Version 1.0 | Updated 2026-10-10
Repository: `Cyrrenza-v2/Invest-broker`
Working branch: `feature/platform-foundation`

## Purpose
This plan operationalizes the User Platform / Admin-Manager Platform / Shared Secure Core architecture. The two frontends remain separate products with separate navigation, client session storage, API boundaries and authorization. Both use shared backend services and the same authoritative database/ledger only through server-enforced controls.

This is an implementation plan, not a claim that every listed feature already exists or that production is ready.

## Non-negotiable boundaries
1. User and Admin are separate applications. No public admin registration.
2. The browser never writes financial balances, posted ledger entries, provider payment status, compliance decisions or audit history directly.
3. Every API request enforces authentication, account/session state, role, permission, resource scope, input validation and required MFA assurance on the server.
4. User-facing mock data must be explicitly labelled demo/sample and must never be confused with live financial data.
5. WebSockets deliver authorized server-originated events; they do not authorize financial commands. Commands use authenticated APIs and transactional backend services.
6. AI is read-only by default. It can draft recommendations or notifications but cannot approve its own actions, create profit, bypass compliance or move funds.
7. Real deposits, withdrawals, custody transfers and return posting stay disabled until approved provider integrations, accounting invariants, reconciliation, security tests and applicable legal/compliance reviews pass.
8. Never claim a feature is implemented, tested, deployed or production-ready without evidence for that specific milestone.

## Existing verified baseline
- User and Admin Vite entry points exist in the repository.
- User API and Admin API are deployed in Supabase and were active with JWT verification enabled at the last inspection.
- Both frontends use distinct local session-storage keys.
- The public schema had 17 tables with RLS enabled at the last inspection.
- User API supports reads and support-message creation; other POST actions are disabled.
- Admin API is read-only and rejects non-GET requests.
- The security advisor returned no lints in the last inspection; this is not a substitute for application-level authorization and financial tests.
- Current production Vercel deployment has not been verified.
See `docs/IMPLEMENTATION_GAP_ASSESSMENT.md` for details.

## Phase gates

### Phase 1 — Architecture and contracts
**Status: Route foundation implemented on `feature/platform-foundation`; tests added, CI verification pending.**
- Added a shared route contract for user sections and admin sections, including explicit login/register/reset route modes.
- Connected browser history/popstate to both application shells so section navigation updates the URL and direct route loads resolve to the intended section.
- Added Vercel rewrites for direct user routes and `/admin/*` routes to the correct separate HTML entry point.
- Added Node built-in route-contract tests for route coverage, unknown paths, auth modes, and separation between user/admin route maps.
- This is routing foundation only: it does not replace server-side authorization, and unknown route handling in the app shell still needs browser-level validation.
- Freeze route inventory for both applications.
- Create a screen-to-component-to-API matrix including loading, empty, error, validation, disabled and success states.
- Define common error envelope, pagination, currency/amount representation, timestamps and idempotency conventions.
- Document role/permission matrix and data ownership rules.
**Exit:** contracts reviewed and no UI control has an undefined behavior.

### Phase 2 — User frontend foundation
**Status: Existing foundation; full route-by-route visual and interaction verification outstanding.**
- Complete customer navigation and all listed screens.
- Use deterministic sample fixtures only where APIs are not ready; visibly label them.
- Implement reusable accessible controls and responsive mobile layouts.
- All unsupported financial actions remain disabled with explanatory text.
**Exit:** route, form, keyboard, mobile and error-state tests pass.

### Phase 3 — Admin frontend foundation
**Status: Existing foundation; route coverage and permissions UI need verification.**
- Complete dedicated admin navigation and screen shells.
- Show authorized data only; never infer authorization from hidden UI elements.
- Display explicit read-only/unavailable states for unimplemented mutations.
- Build role/permission-aware affordances without relying on them as the security boundary.
**Exit:** direct-route, refresh, MFA-prompt and responsive tests pass.

### Phase 4 — User backend foundation
**Status: Partial.**
- Specify and implement profile, KYC, bank-account, support-ticket, notification and statement APIs.
- Enforce ownership via token-derived user ID; ignore client-supplied owner IDs.
- Rate-limit authentication/recovery and avoid account enumeration.
**Exit:** positive and negative endpoint tests pass, including cross-user denial.

### Phase 5 — Admin backend foundation
**Status: Partial, read-only baseline.**
- Define explicit permissions and resource scopes per route.
- Verify trusted server-controlled roles, account state and MFA/AAL2 for protected endpoints.
- Add pagination, filter allowlists, field minimization and audit events.
- Keep all financial mutations closed until the corresponding workflow is complete.
**Exit:** wrong-role, missing-MFA, stale-session, suspended-account and cross-scope tests all deny safely.

### Phase 6 — Database and ledger
**Status: Partial foundation; ledger invariant test coverage outstanding.**
- Define chart of accounts and journal transaction model.
- Enforce balanced debits/credits per currency in database transactions.
- Posted entries are immutable; corrections use linked reversal transactions.
- Add unique idempotency keys and provider-event deduplication.
- Add atomic holds/reservations and concurrency protection.
**Exit:** invariant, rollback, replay, concurrency and reversal tests pass.

### Phase 7 — Business engines
**Status: Not complete.**
- Investment engine: eligibility, plan version, amount limits, terms acceptance, atomic ledger posting.
- Deposit engine: provider initiation, signed event verification, reference/amount/currency matching, duplicate handling and reconciliation.
- Withdrawal engine: eligibility, KYC/compliance gates, atomic reservation, maker-checker approval, payout adapter, retry safety and recovery.
- Result/return engine: source evidence, calculation/versioning, projected/accrued/realized/credited separation, approved posting only.
- KYC, notifications, support, risk, statements and reporting modules.
**Exit:** provider sandbox and end-to-end workflow tests pass; production financial operations still require release approval.

### Phase 8 — Security hardening
**Status: Ongoing.**
- Review all RLS policies, grants, triggers, privileged SQL functions and storage policies.
- Private KYC documents use private buckets and short-lived authorized access.
- Add MFA enrollment/recovery, session revocation, rate limits, abuse monitoring and security alerts.
- Add immutable or tamper-resistant audit strategy.
**Exit:** security review and authorization regression suite pass.

### Phase 9 — Frontend/backend connection preparation
**Status: Partial.**
- Freeze typed request/response schemas and common errors.
- Map each screen action to an API or explicit disabled state.
- Define safe retry behavior and idempotency for commands.
**Exit:** contract tests pass for every connected screen.

### Phase 10 — WebSocket infrastructure
**Status: Not verified/complete.**
- Authenticate connection and authorize subscriptions per user/resource.
- Deliver server-originated, non-authoritative status/notification events.
- Use sequence IDs, reconnect/resubscribe, deduplication and missed-event recovery.
- Never accept a socket message as proof of payment or permission to mutate balances.
**Exit:** unauthorized subscription, disconnect/replay and duplicate-event tests pass.

### Phase 11 — Connect User frontend to backend
**Status: Partial reads already connected; broader contract remains.**
- Connect one feature domain at a time, starting with profile and read-only wallet/transactions.
- Validate loading, empty, error, retry and ownership behavior.
- Then connect KYC/support/notifications and only later sandbox financial commands.
**Exit:** automated API/UI integration tests pass before next domain.

### Phase 12 — Connect Admin frontend to backend
**Status: Partial read-only connection.**
- Connect dashboard and scoped read-only records first.
- Add queue/review workflows only after permission and audit tests pass.
- Keep execution and fund movement disabled until release gates pass.
**Exit:** each route has API contract and authorization test evidence.

### Phase 13 — Real-time events
**Status: Not verified/complete.**
- Connect notifications, support updates and non-authoritative workflow status events.
- Verify that the client refreshes authoritative state from APIs after events.
**Exit:** event authorization, replay, reconnect and consistency tests pass.

### Phase 14 — Financial workflow testing
**Status: Not complete.**
- Run sandbox-only deposit, investment, return, withdrawal, payout failure, reversal and reconciliation scenarios.
- Include duplicate callbacks, forged callbacks, concurrency, partial failures and recovery.
**Exit:** ledger balances reconcile, no duplicate credits/payouts occur, and all state transitions are audited.

### Phase 15 — End-to-end and operational testing
**Status: Not complete.**
- Test user and admin flows independently and together.
- Test route refreshes, responsive layouts, accessibility, performance, backups, restore, alerts and incident procedures.
**Exit:** release checklist signed off with reproducible evidence.

### Phase 16 — Production deployment
**Status: Not verified.**
- Confirm production domain, build configuration, environment variables and secret separation.
- Verify CI, deployment commit, frontend health, Edge Function versions and database migration state.
- Keep payment/payout/financial posting feature flags disabled until formal release approval.
**Exit:** deployment and operational readiness verified; legal/compliance and provider requirements met.

## Recommended immediate work
1. Build a route/screen/API contract matrix with every button and form validation.
2. Implement and test explicit Admin API permissions/resource scopes.
3. Complete the user account/KYC/document APIs.
4. Add ledger invariant and idempotency tests before implementing financial mutations.
5. Verify direct routes and actual production deployment separately.

## Definition of done
A feature is done only when its implementation is committed, its tests pass, its authorization is tested (including denial cases), its user-visible states are complete, and its target environment is verified. A specification or successful database migration alone does not satisfy this definition.
