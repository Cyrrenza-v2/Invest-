# Invest Broker — Master Technical Specification
Version: 1.0  
Status: Baseline blueprint; implementation and release gates remain outstanding  
Repository: `Cyrrenza-v2/Invest-broker`  
Working branch: `feature/platform-foundation`  
Last updated: 2026-10-10

## 1. Purpose and product boundaries

Invest Broker is a proposed investment-platform product with a customer application and a restricted manager/admin application. This document is the implementation source of truth for product decisions, routes, permissions, data boundaries, financial invariants, APIs, operations, and release acceptance.

**This document does not authorize accepting public funds or promising returns.** The platform must remain in simulation/read-only mode for financial movement until the business model, Nigerian legal/regulatory position, custody/payment arrangements, and technical controls have been independently reviewed and signed off.

### 1.1 Product principles
- The server/database is authoritative for identity, roles, account status, investment terms, money, return calculations, and transaction state.
- Customer and admin interfaces are separate entry points with separate browser session-storage keys and independent authorization gates.
- Customer funds, company operating funds, and provider/custody balances are distinct accounting concepts and must never be silently combined.
- Financial records are append-only where practical. Corrections use linked reversal/adjustment entries, not destructive edits.
- Every sensitive admin action is authorized server-side and audited.
- No UI success message is evidence that a payment, payout, or investment has settled.
- All amounts use an explicit currency and exact decimal/minor-unit representation; never binary floating-point for authoritative money arithmetic.
- The platform must be honest about missing, delayed, unverified, or unreconciled data.

## 2. Decisions required before public launch

These are business/compliance decisions, not assumptions for engineers to invent:
1. Legal entity, target markets, intended customer eligibility, and Nigerian regulatory/licensing assessment.
2. Product type and whether each product is a regulated investment, savings product, or another legally classified arrangement.
3. Investment plan names, minimum/maximum principal, duration, funding/settlement rules, maturity and early-exit rules.
4. Return methodology, rates or formula, whether returns are variable or fixed, calculation calendar, rounding, compounding, fees, losses, and whether returns are projected, accrued, approved, or actually credited.
5. Currency support (initial UI currently formats NGN), account limits, deposit/withdrawal limits, cut-off times, fees, and taxes.
6. Provider(s) for payments, custody/client-money safeguarding, payout, bank verification, and reconciliation.
7. KYC/AML/CFT requirements, source-of-funds triggers, sanctions/PEP screening, risk escalation, complaints handling, record retention, and reporting obligations.
8. Customer terms, privacy notice, investment/risk disclosures, consent, cancellation/refund terms, and complaints escalation.
9. Support service levels, business continuity, incident response, retention/deletion rules, and recovery objectives.
10. Production risk owner and named approvers for policy, compliance, treasury, security, and release.

No projected or illustrative return may be presented as guaranteed or as already earned. Legal/compliance review by qualified Nigerian professionals is a release gate.

## 3. Applications, routes, and session boundaries

### 3.1 Customer app
- `/login` — email/password login; show/hide password; forgot password; link to registration.
- `/register` — full name, email, phone, password, confirmation, terms acceptance.
- `/verify` — verification challenge and resend/cooldown state where configured.
- `/forgot-password` and `/reset-password` — secure recovery flow.
- `/dashboard` — own account overview only.
- `/investments`, `/investments/:id` — own investments, terms, events, maturity, return status.
- `/wallet`, `/transactions` — own balances and posted ledger/transaction history.
- `/deposit`, `/withdraw` — request and track funding/payout states; no client-side credit/debit.
- `/notifications`, `/profile`, `/kyc`, `/support`, `/security`, `/statements`.

Customer dashboard content: available/held/invested balances with clear definitions, investments, verified credited returns versus projected/accrued values, deposits, withdrawals, KYC status, notices, and recent transactions. Only own records are visible.

### 3.2 Admin app
- `/admin/login` — restricted login, no public admin registration.
- `/admin/dashboard`
- `/admin/users`, `/admin/users/:id`, `/admin/kyc`
- `/admin/investments`, `/admin/investment-plans`, `/admin/returns`
- `/admin/deposits`, `/admin/withdrawals`
- `/admin/treasury`, `/admin/fund-movements`
- `/admin/compliance`, `/admin/risk`, `/admin/support`
- `/admin/ai`, `/admin/reports`, `/admin/audit`, `/admin/settings`, `/admin/security`.

The repository currently uses separate Vite entry points (`index.html` and `admin.html`). The routes above are target routes; direct-load, refresh, hosting rewrite, and not-found behavior must be tested before they are claimed as operational. Admin entry URL currently intended: `/admin.html` until routing is implemented and verified.

### 3.3 Session rules
- Customer client storage key: `invest-broker-user-auth-v1`.
- Admin client storage key: `invest-broker-admin-auth-v1`.
- These keys isolate browser persistence; they do not create separate identity providers or replace server authorization.
- Both apps currently use the same Supabase Auth project. Every admin API must validate the access token, active account/session policy, trusted role and required permission on the server.
- Admin access requires verified TOTP MFA and an appropriate AAL2 assurance level. No manager dashboard or admin API data is available before the MFA gate.
- Admin MFA enrollment/recovery, device/session revocation, login alerts, and session lifetime policy must be completed and tested before production.
- Sign-out and token refresh behavior must be tested independently for both apps. A stale role claim must not grant lasting privilege after role removal.
- Use Supabase `app_metadata`/trusted server-side role assignment; never use user-editable `user_metadata` for authorization.

## 4. Role and permission model

### 4.1 Roles
- `user`: customer self-service.
- `manager`: operational management within explicit permission grants.
- `admin`: system/security administration, still subject to separation of duties.
- Future optional roles: `compliance_officer`, `finance_operator`, `support_agent`, `auditor`. Do not grant these until a real operational need and policy exist.

Use a permission registry (for example, `users.read`, `kyc.review`, `deposits.review`, `withdrawals.review`, `withdrawals.execute`, `plans.manage`, `returns.propose`, `treasury.read`, `reports.export`, `audit.read`, `security.manage`). Role names alone should not imply every permission.

### 4.2 Customer permissions
Allowed: read/update permitted own profile fields; read own wallet, investments, ledger history, deposits, withdrawals, notifications, statements and support cases; submit deposit/withdrawal requests; submit KYC documents; manage permitted security settings.
Denied: other customers' records, treasury, internal ledger accounts, audit logs, investment-rule changes, return adjustment, payout approval/execution, compliance overrides, admin AI controls.

### 4.3 Manager/admin permissions
Access only after trusted role, active account, MFA and per-action permission checks. KYC reviewers review; finance operators reconcile; withdrawal approvers authorize; payout executors execute only after approval. High-risk actions should use maker-checker separation: the same person must not both initiate and approve a sensitive transfer where feasible. If one-person operations are initially unavoidable, use explicit dual-control exception policy, re-authentication, reason capture, alerts, and post-action review rather than pretending the separation exists.

### 4.4 Mandatory authorization
Each API request must validate authentication, account/session status, role/permission, record scope, required MFA assurance, input schema, and action-specific policy. UI hiding is not security. Direct navigation to `/admin/*` by a customer must show an access-denied state, and the admin API must return HTTP 403 (or 401 when unauthenticated).

## 5. Screen and interaction standards

The detailed screen-by-screen plan is maintained in `docs/SCREEN_SPECIFICATION.md`. Every screen must specify loading, empty, error, success, stale-data and permission-denied states. Buttons must have defined behavior; unimplemented actions must be disabled and labelled as unavailable, not simulated as successful.

### 5.1 Customer screen contract
- Login/register/recovery: validation, clear errors, rate-limit messaging, verification states, accessible labels, no account enumeration in recovery responses.
- Dashboard: balances clearly classified; only server-sourced data; freshness timestamp and retry behavior.
- Investment list/detail: principal, plan/version, start/end/maturity, lifecycle status, disclosed return method, accrued versus posted return, and event history.
- Wallet/transactions: available, reserved/held, invested, and posted amounts distinguished; paginated chronological history; references and status explanations.
- Deposit: provider-generated instructions/reference, pending/confirmed/failed/expired states; never trust a client success redirect.
- Withdrawal: bank-account verification, available amount, fee disclosure, KYC/policy checks, request reference, processing states and safe cancellation rules.
- KYC: consent, secure upload, document type/status, rejection reason where policy permits, resubmission and retention disclosure.
- Support: ticket category, subject, message, permitted attachment, history, status, escalation and resolution.
- Security: password reset/change, MFA state, session/device list and revocation only once corresponding backend controls exist.

### 5.2 Admin screen contract
- Dashboard: queue counts and totals clearly marked with data freshness and reconciliation status.
- Users/KYC: search, filters, least-privilege detail view, review decision with reason and audit trail.
- Investment plans/returns: versioned rules; changes require effective date, authorization and audit. No retroactive silent edits.
- Deposits/withdrawals: provider reference, evidence, policy checks, risk holds, review history and reconciliation. Buttons must call a secure backend workflow; no direct table update.
- Treasury/fund movements: company and client-money views are distinct, with settlement/reconciliation indicators and approvals.
- Compliance/risk: restricted data, case ownership, decision rationale, escalation and immutable event history.
- AI: advisory-only unless specifically reviewed; no direct credentials, arbitrary SQL, ledger writes, approvals, or payment execution.
- Reports/audit/settings/security: permission-gated access, export controls, retention, immutable audit visibility and configuration change history.

## 6. Database domains and core entities

Current foundation migration is `supabase/migrations/20261010055354_invest_broker_shared_platform_foundation.sql`. It establishes these tables: `profiles`, `wallets`, `investment_plans`, `investments`, `ledger_entries`, `deposits`, `withdrawals`, `support_messages`, `compliance_cases`, `treasury_accounts`, `audit_logs`. Do not assume all future entities or columns below already exist.

### 6.1 Planned domain additions / verification
- Auth/security: profile/account state, trusted role grants, session/device events, MFA recovery events.
- KYC: `kyc_profiles`, `kyc_documents`, `verification_events` (sensitive documents in private storage; minimal metadata in DB).
- Investments: versioned `investment_plans`, `investments`, `investment_events`, `return_calculations`/accruals, `return_credits`.
- Accounting: `ledger_accounts`, immutable `ledger_transactions`, `ledger_entries`, holds/reservations, reversal links and reconciliation records.
- Payments: `deposits`, `payment_transactions`, `provider_webhook_events`, `withdrawals`, `payouts`, provider settlement records.
- Risk/compliance: `risk_alerts`, `compliance_cases`, `compliance_reviews`, `complaints`.
- Operations: `notifications`, `support_tickets`, `support_messages`, `audit_logs`, `admin_actions`, `idempotency_keys`, `outbox_events`.

### 6.2 Data conventions
- UUID primary keys; foreign keys; created/updated timestamps; explicit currency; database constraints for valid status transitions where appropriate.
- Store money in integer minor units or PostgreSQL `NUMERIC` with a documented scale and currency exponent. Avoid JavaScript floating-point for financial decisions.
- Keep provider IDs/references unique within provider scope. Apply idempotency keys to all retryable mutations.
- Use explicit column selection, pagination and server-side filtering. Do not use broad `select(*)` for sensitive/admin data.
- Every exposed public-schema table has RLS. RLS policies must include ownership predicates and both `USING` and `WITH CHECK` where applicable. Views must not unintentionally bypass RLS; privileged functions require a reviewed threat model.
- Never expose service-role or secret keys to browser code.
- Private KYC files use private Storage buckets and narrow policies; use short-lived signed URLs only after server-side authorization.

## 7. Accounting and ledger invariants

A wallet is a projection of ledger activity, not an editable source of truth.

- Each posted transaction has a unique ID, currency, amount, timestamp, source/destination accounts, reference, origin, actor/system identity, status and idempotency key.
- Every journal transaction balances: sum of debits equals sum of credits per currency.
- Posted entries are immutable. Correct mistakes with linked reversal and replacement entries.
- Pending deposits do not increase spendable balance. Provider-confirmed funds are credited exactly once after signature/authenticity, amount, currency, recipient and reference validation.
- Withdrawal requests reserve/hold eligible funds atomically. Failed/cancelled requests release holds exactly once; successful payouts settle against provider evidence and reconciliation.
- Investment principal movement, return accrual, approved return credit, fees, and withdrawal are separate transaction types and must be traceable.
- Projected/accrued return is not withdrawable until the defined product rules and approved posting event say it is available.
- Client/customer funds, custody/provider clearing accounts, and company operating/fee accounts must be separate ledger accounts and reconciled independently.
- All financial state changes happen in trusted server/database transactions, with row locking or equivalent concurrency protection, idempotency, audit event, and an outbox/notification event.
- No admin UI, AI output, webhook redirect, or client-supplied balance can directly alter a balance.

## 8. Investment lifecycle and return engine

Suggested lifecycle: `draft → pending_funding → active → matured`; terminal/exception states include `cancelled`, `early_exit_requested`, `closed`, `suspended`, `disputed`. Final allowed transitions depend on the approved business rulebook.

For each investment, preserve a snapshot of the accepted plan version and terms. Record principal, currency, start/end dates, maturity, status, and source transaction. Return calculations must be deterministic, versioned, repeatable and auditable, including calendar/time zone, day-count convention, compounding, rounding, fees/tax, and handling of missed jobs or corrections.

A background worker/job should calculate accruals only if the selected product model requires them. Accruals must not be mistaken for settled cash. Maturity and return credit should be idempotent and use a server-controlled posting workflow. Do not enable return-bearing plans until terms and calculation examples are approved and independently tested.

## 9. Deposit workflow

1. Customer selects method and amount; server validates eligibility, limits, currency and idempotency.
2. Server creates a pending deposit and obtains provider instructions/reference where applicable.
3. Provider sends a signed webhook or a server-to-server status confirmation.
4. Backend validates signature, timestamp/replay window, provider account, reference, amount, currency, status and uniqueness.
5. Backend processes the event once, posts balanced ledger entries transactionally, and stores the raw/minimized event evidence safely.
6. Reconciliation compares internal records with provider settlement reports; mismatches become review cases.
7. Notify customer only after the state transition is committed.

Support pending, confirmed, failed, expired, reversed/refunded, underpaid, overpaid and manual-review states as required. Never credit solely because the browser returns to a success page.

## 10. Withdrawal workflow

1. Customer submits amount, currency and verified payout destination.
2. Backend validates account status, KYC, available balance, holds, plan restrictions, limits, fees and risk/compliance policy.
3. Atomically reserve eligible funds and create a pending request with an idempotency key.
4. Run risk screening and route to authorized reviewer(s).
5. Require fresh MFA/re-authentication for sensitive approval and execute only through the configured provider/custody integration.
6. Store provider payout reference and execution status; do not mark completed from a client response.
7. Reconcile payout against provider evidence; finalize ledger and release/settle holds exactly once.
8. Notify the customer and record full audit history.

Every decline/hold requires a controlled reason. Retry and failure handling must prevent duplicate payout. If no verified payout provider and approved custody/legal structure exists, keep execution disabled.

## 11. Treasury and reconciliation

Treasury screens are accounting/operations views, not a mechanism to route customer money to a personal account. Model client/custody money, provider clearing/settlement, company operating funds and fees separately. Require authorized transfer intents, limits, maker-checker approvals where feasible, independent provider confirmation, statement matching, exception queues and daily close controls. No transfer should be executable from the UI alone.

## 12. AI assistant boundaries

Initial implementation is read-only/advisory. Allowed: summarize authorized records, explain policy, draft customer messages, identify anomalies for human review, prepare report drafts and reconciliation exceptions. Disallowed: direct SQL access, credential disclosure, role changes, KYC override, arbitrary balance edits, ledger deletion, payment/withdrawal execution, autonomous approval or changing investment rules.

Use a narrow server-side tool allowlist; enforce the current actor's permissions for every retrieval; minimize sensitive data sent to a model; treat user-provided text and uploaded content as untrusted; log prompts/tool actions according to privacy policy. AI suggestions must be clearly labelled and reviewed by an authorized human before any separately authorized backend workflow can execute an action.

## 13. Notifications and support

Events may produce in-app, email, SMS or push notifications only through configured providers and consent/policy rules. Delivery is asynchronous and retryable; use an outbox pattern to avoid losing notifications after committed transactions. Avoid secrets and excessive financial/KYC details in notification content.

Support tickets need ownership, category, priority, assignment, messages, attachments, status transitions, escalation, resolution reason and retention policy. Customer access is own tickets only; internal notes are never exposed to the customer. Complaints should be trackable separately where regulation/policy requires it.

## 14. API contracts

All endpoints require versioning, schema validation, auth, authorization, request-size limits, rate limiting, structured errors, correlation IDs, idempotency on mutations, and no-store caching for sensitive responses. Example logical routes (exact implementation may use Supabase Edge Function route handlers):

### Customer
- `GET /api/me`, `PATCH /api/me`
- `GET /api/me/wallet`, `GET /api/me/transactions`
- `GET /api/me/investments`, `GET /api/me/investments/:id`
- `POST /api/me/deposits`, `GET /api/me/deposits`
- `POST /api/me/withdrawals`, `GET /api/me/withdrawals`
- `GET /api/me/notifications`, `POST /api/me/notifications/:id/read`
- `POST /api/me/kyc`, `GET /api/me/kyc`
- `GET/POST /api/me/support/tickets`, `GET/POST /api/me/support/tickets/:id/messages`
- `GET /api/me/statements`

### Admin
- `GET /api/admin/dashboard`
- `GET /api/admin/users`, `GET /api/admin/users/:id`
- `GET/POST /api/admin/kyc/reviews`
- `GET /api/admin/investments`, `GET/POST /api/admin/investment-plans` (versioned, permissioned)
- `GET /api/admin/returns`, `POST /api/admin/returns/:id/review`
- `GET /api/admin/deposits`, `POST /api/admin/deposits/:id/review`
- `GET /api/admin/withdrawals`, `POST /api/admin/withdrawals/:id/approve`, `POST /api/admin/withdrawals/:id/reject`
- `POST /api/admin/withdrawals/:id/execute` (disabled until provider, approval and custody gates pass)
- `GET /api/admin/treasury`, `GET /api/admin/reconciliation`
- `GET /api/admin/compliance`, `GET /api/admin/risk`
- `GET /api/admin/reports/:type`, `GET /api/admin/audit`, `GET/PATCH /api/admin/settings`
- `POST /api/admin/ai/query` (read-only allowlist only)

For each endpoint define request/response schema, permission, MFA requirement, idempotency behavior, error codes, audit event and tests before implementing. Never accept a client-supplied user ID as proof of ownership.

## 15. Technology and infrastructure

Current baseline: React + Vite multipage frontend; Supabase Auth/Postgres/RLS/Edge Functions; GitHub source and Actions; Vercel hosting target. Confirm exact dependencies and deployed configuration from the repository before claiming versions or live status.

Required environments: local/development, staging, production with isolated data, credentials, webhook endpoints and payment accounts. Use GitHub Actions for lint/type/build/test and migration checks; deploy staging first; promote reviewed immutable commits to production. Protect `main`, require review/checks, pin dependencies and commit lockfiles. Vercel environment variables must be configured separately for each environment. Browser keys may be publishable keys only; server secrets belong in Supabase/Vercel secret stores as appropriate.

Operational controls: HTTPS, CSP/security headers, dependency scanning, centralized structured logs, alerting, error tracking, uptime checks, database backups, tested restore, documented incident response and change rollback. Set and test RPO/RTO before launch. Never log passwords, OTPs, full access tokens, secret keys, or unnecessary identity data.

## 16. Security requirements

- Strong password and recovery policy; rate limits and anti-enumeration responses.
- MFA enrollment, verification, recovery and revocation tested for management accounts.
- Trusted role assignment only by controlled server-side provisioning; no public admin signup.
- RLS and API-level authorization, with negative tests for IDOR/BOLA and privilege escalation.
- Strict CORS, security headers, CSRF protection where cookie-based auth requires it, input validation, output encoding and safe file uploads.
- Secret scanning, dependency lockfiles, server-only privileged keys and rotation procedure.
- Webhook signature verification, replay defense, idempotency and provider reconciliation.
- Append-only audit log with actor, action, target, reason, correlation ID, timestamp and outcome; restrict read/write access.
- Session revocation and active-account checks appropriate to risk; short admin sessions and re-authentication for sensitive actions.
- Backups, restore drills, incident response, anomaly detection and alerting.
- Security advisor and policy review after each relevant schema/function change. Privileged database functions need a documented justification, fixed search path where relevant, minimal grants and adversarial review.

## 17. Reports and exports

Customer reports: account statement, investment history, posted returns, deposits, withdrawals and transaction history. Admin reports: customer growth, KYC queue, investments, returns, deposits, withdrawals, fees, treasury, provider reconciliation, risk/compliance and audit events. Totals must state the date range, currency, timezone, source, generation timestamp and reconciliation status. CSV/PDF/XLSX exports are permission-gated, logged, scoped, and protected from spreadsheet formula injection. Reports must not imply that unreconciled records are settled cash.

## 18. Testing and release acceptance

### Automated
- Unit tests for money arithmetic, return calculations, state transitions, fee rules and validation.
- Integration tests for Auth, RLS, APIs, database transactions, idempotency, webhooks, outbox and reconciliation.
- End-to-end tests for customer and admin login, recovery, MFA, navigation, mobile responsiveness and error states.
- Security tests for user/admin separation, role downgrade, stale tokens, IDOR, privilege escalation, rate limits, webhook replay, duplicate deposit/withdrawal, malicious uploads and secret leakage.
- Load tests for expected traffic and background jobs.

### Required financial scenarios
- Confirmed deposit credits exactly once; duplicate webhook changes no balances.
- Pending/failed deposit is not spendable.
- Investment principal is reserved/transferred exactly once and wallet balances reconcile.
- Accrual is not treated as posted/withdrawable cash.
- Return credit posts only after authorized, deterministic calculation and approval rules.
- Withdrawal reserves eligible funds atomically; two concurrent requests cannot overspend.
- Failed payout releases/settles holds once and is reconciled to provider evidence.
- Reversal is linked to original transaction; historical entries are not overwritten.
- Per-currency debits equal credits for every posted journal transaction.

### Mandatory negative tests
- Customer requests another customer's record: denied.
- Customer calls any admin endpoint: 403.
- Admin without verified MFA calls protected admin endpoint: denied.
- User-editable metadata attempts to grant manager role: denied.
- Suspended account/session attempts a sensitive action: denied.
- Repeated idempotency key or provider webhook does not repeat the side effect.
- UI navigation, fabricated success redirects and AI suggestions cannot mutate financial state.

## 19. Implementation sequence

1. Finalize business rules and obtain regulatory/legal assessment.
2. Finalize permission matrix and threat model.
3. Review database schema, constraints, RLS, Storage policies and privileged functions.
4. Design balanced ledger, idempotency and audit model.
5. Implement and test shared server API contracts.
6. Complete customer/admin auth, MFA, role provisioning, recovery and session controls.
7. Implement deposit provider integration and reconciliation in sandbox.
8. Implement versioned investment and return engine with approved examples.
9. Implement withdrawal review, payout sandbox and reconciliation.
10. Build treasury, compliance, risk, support and notifications.
11. Complete customer UI and admin UI against the screen specification.
12. Add AI read-only service, reports and exports.
13. Complete security review, load tests, backup/restore and incident drills.
14. Deploy staging, run end-to-end acceptance and reconcile test scenarios.
15. Obtain legal/compliance, operations and security sign-off.
16. Production launch only after all release gates pass; enable money movement gradually with monitoring and rollback controls.

## 20. Current state versus target state

This is a plan, not a declaration that every capability exists. The current repository has a frontend foundation, a Supabase foundation migration and an open feature branch/PR. Some admin/customer reads and screens exist, but provider-backed payments, production-grade investment/return processing, complete MFA enrollment/recovery, complete support/notification/report services, admin mutation workflows, route rewrites, and live production verification must be inspected and tested individually. The AI screen is currently a read-only prototype, not a connected AI model. Financial actions must remain disabled until the relevant server workflows and external integrations pass acceptance.

### Release gate
A feature is **Done** only when its implementation is committed, automated tests pass, security permissions are verified with positive and negative tests, deployment is verified in the intended environment, and operational documentation is updated. A green frontend build alone does not make a financial feature production-ready.
