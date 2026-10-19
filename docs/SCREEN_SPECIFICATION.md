# Invest Broker — Screen Specification
Version: 1.0
Status: Product/UX specification; implementation follows after API and schema review.

## 1. Product boundaries

- User application: customer self-service only. It must not contain management navigation or expose admin-only records.
- Admin application: separate entry point and shell, with its own login and mandatory MFA. Do not link it from the normal user navigation.
- User API and Admin API are separate authorization boundaries. Both call the shared core services and PostgreSQL database.
- The ledger is the authoritative financial record. UI totals are derived from posted ledger records and reconciled investment records; never treat a displayed wallet number as permission to mutate money.
- Do not invent balances, returns, activity, customer counts, or payment confirmations. Unknown values show a neutral unavailable state.
- No live-money action is enabled until its backend workflow, regulated payment/custody integration, reconciliation, audit trail, and tests are complete.

## 2. Global visual and interaction rules

### Layout
- Responsive: phone (320 px and up), tablet, desktop.
- User app: compact mobile bottom navigation for Dashboard, Investments, Wallet, Transactions; remaining pages in a menu. On desktop, use a left sidebar.
- Admin app: independent desktop/tablet sidebar and mobile drawer. No user-app navigation links.
- Use the system light/dark appearance. Do not hard-code the overall page background; use theme-aware surfaces and accessible contrast.
- Keep the active page, signed-in identity, connection/loading state, and sign-out action visible where appropriate.

### Status tokens
Use text plus an icon, not color alone:
- Success / completed / verified: green.
- Pending / awaiting review / processing: amber.
- Rejected / failed / suspended / overdue: red.
- Informational / active / scheduled: blue.
- Draft / inactive / unavailable: neutral gray.
- Compliance hold: red/amber with explicit "Hold" text and reason when disclosure is permitted.

### Standard states on every data page
- Loading: skeletons; do not show fabricated zero values while loading.
- Empty: explain that there are no records and show a relevant safe next step.
- Error: plain-language message, Retry button, request/correlation reference if available.
- Stale/offline: show last-updated time and mark data as stale; do not present cached data as live.
- Permission denied: show an access-denied screen, not an empty table.
- Forms: inline validation, disabled submit while saving, duplicate-submit protection, clear success/error outcome, and confirmation for consequential actions.
- Tables: search/filter/sort/pagination, responsive card layout on small screens, accessible labels, and consistent status chips.

## 3. User application

### Entry points and navigation
- `/login`: email and password; Forgot password; link to Register. No role selector.
- `/register`: full name, email, password, password confirmation, terms/privacy acknowledgement. Explain email verification if enabled.
- `/dashboard`
- `/investments`, `/investments/:id`
- `/wallet`
- `/deposit`
- `/withdraw`
- `/transactions`
- `/notifications`
- `/profile`
- `/kyc`
- `/support`
- `/security`

If the current multipage setup uses `/` for the user app, route these paths within that entry point or configure rewrites without exposing the Admin shell.

### U1. Login / Register / Password reset
**Components:** brand mark, page title, email, password, show/hide password, submit, forgot-password link, register/login link.
**Actions:** Sign in; create account; request reset email; resend verification where supported.
**Behavior:** Supabase Auth authenticates the identity. Never store or log raw passwords. Redirect an authenticated customer to Dashboard; if a manager attempts user login, do not grant admin UI access—direct them to the separate admin entry.
**States:** invalid credentials, unverified email, rate-limited, network failure, reset sent, registration pending verification.

### U2. Dashboard
**Cards:** Total balance, invested amount, available balance, accrued returns, credited returns, active investments, next withdrawal date.
**Sections:** active investments preview; recent transactions; investment opportunities; important notifications.
**Buttons:** View investments, View wallet, Deposit, Withdraw, View all transactions, View notifications.
**Behavior:** Every figure is sourced from secured backend responses and labelled by meaning/currency. Separate accrued (not yet credited) from posted/credited returns. If a metric cannot be computed reliably, display "Unavailable" with explanation rather than a guessed number.
**Restrictions:** no deposit/withdraw action can imply a real payment has happened before provider confirmation.

### U3. Investments list and detail
**List columns/cards:** plan, principal, currency, start date, maturity date, status, return terms/version, details.
**Filters:** status, date range; sort by created/start/maturity date.
**Plan catalogue:** plan name, clear product description, minimum/maximum, duration, disclosed rate/method, fees/risks, terms version and effective date.
**Buttons:** View details; Start investment only when the backend investment-creation workflow is implemented and the plan is active.
**Detail page:** investment reference, plan version, principal, dates, status history, return calculation records and explanation, linked ledger transactions.
**Confirmation:** show plan terms and total debit before a future investment submit; require explicit acknowledgement.
**Statuses:** Pending, Active, Matured, Withdrawn, Cancelled, Suspended.

### U4. Wallet
**Cards:** available balance, invested balance, pending amount, accrued returns, credited returns, currency.
**Sections:** latest ledger transactions and balances by category where supported.
**Buttons:** Deposit, Withdraw, Transactions.
**Behavior:** distinguish posted, pending, reserved, and invested amounts. Explain that the ledger is authoritative. No editable balance field or "add funds" shortcut exists.

### U5. Deposit
**Fields:** amount, currency (only supported currencies), payment method/provider from backend, idempotency key generated by client for request correlation.
**Review panel:** amount, fees if applicable, expected instructions, expiry, deposit reference.
**Buttons:** Continue / Create deposit request; Cancel; Check status.
**Behavior:** a request is not a confirmed deposit. Credit only after trusted, signature-verified provider confirmation processed idempotently by backend. Never trust a frontend success redirect.
**Statuses:** Draft, Pending, Awaiting payment, Processing, Confirmed, Failed, Expired, Reversed.
**Current capability:** keep real deposit submission disabled until provider integration is configured and tested.

### U6. Withdrawal
**Fields:** amount, saved destination (masked), add/change destination through a separately verified workflow, optional reason.
**Eligibility panel:** available amount, KYC/security requirements, withdrawal window/cut-off, minimum/maximum, fees, next eligible date, hold reason if visible.
**Buttons:** Check eligibility; Review request; Submit request; Cancel only when policy permits.
**Review screen:** amount, destination, fees, net amount, timing estimate, policy/terms acknowledgement.
**Behavior:** server recomputes eligibility at submit time, checks ownership, KYC, ledger balance, maturity/lock rules, schedule and risk/compliance holds. Create a request, not a payment. Show a unique withdrawal reference.
**Statuses:** Pending, Under review, Approved, Processing, Completed, Rejected, On hold, Cancelled.
**Current capability:** request/approval/payment execution remain disabled until the complete backend workflow is implemented.

### U7. Transactions
**Columns/cards:** date/time, reference, type, description, amount, currency, status, linked investment/deposit/withdrawal.
**Filters:** type, status, date range; search by reference.
**Detail:** immutable transaction reference, posted entries where appropriate, status timeline, provider reference where safe, support link.
**Behavior:** only show the authenticated user's records. Do not expose internal risk notes, other users, provider secrets, or manager-only audit data.

### U8. Notifications
**List:** title, message, category, timestamp, read/unread.
**Actions:** Open related permitted page; mark read; mark all read; notification preferences.
**Behavior:** notification state changes go through an authenticated endpoint. Do not pretend a read action succeeded if the API is not implemented.

### U9. Profile
**Fields:** name, phone, email (verification status), locale/preferences, account status (read-only).
**Actions:** edit only permitted fields; save; cancel; verify changed contact details through a challenge.
**Behavior:** email/password changes use the Auth security flow. Never permit a user to change their role, KYC decision, account restrictions, or account status.

### U10. KYC / Verification
**Cards:** current verification stage, outstanding requirements, submission history, reviewer result/message if disclosable.
**Form:** document type, required details, secure document upload, declarations/consent.
**Actions:** Save draft where supported; Submit for review; replace rejected/expired document.
**Behavior:** private documents are stored in a private bucket with short-lived signed URLs and strict authorization. User-submitted fields never directly set verified status. Only a controlled verification/review workflow can change it.
**Statuses:** Not started, Draft, Submitted, In review, Action required, Verified, Rejected, Expired, Restricted.

### U11. Support
**Components:** ticket/message list, topic, subject, message composer, attachments only after safe upload support exists.
**Actions:** Create message/ticket; send reply; view status.
**Behavior:** every message is scoped to the authenticated user. Validate and limit body size; escape rendered content; no arbitrary HTML.
**Statuses:** Open, Waiting for user, Waiting for support, Resolved, Closed.

### U12. Security
**Cards:** password last changed if available, MFA status, active sessions if supported, recent security events.
**Actions:** change password; enroll/verify MFA; revoke session; sign out all sessions where supported.
**Behavior:** re-authentication for sensitive changes. Do not reveal tokens, secrets, or full session identifiers.

## 4. Admin application

### Entry points and navigation
- Separate login route: `/admin/login`; no link from normal user navigation.
- Target pages: `/admin/dashboard`, `/admin/users`, `/admin/users/:id`, `/admin/kyc`, `/admin/investments`, `/admin/investment-plans`, `/admin/returns`, `/admin/deposits`, `/admin/withdrawals`, `/admin/treasury`, `/admin/fund-movements`, `/admin/ai`, `/admin/reports`, `/admin/risk`, `/admin/audit`, `/admin/settings`, `/admin/security`.
- Current repo has a separate `admin.html` Vite entry. Preserve it as the Admin application entry and configure routing/rewrite to the target paths only after production routing is tested.
- Role comes from trusted server-controlled `app_metadata`, never editable user metadata. Require verified MFA/AAL2 for Admin API reads and all sensitive actions.

### A1. Admin login and MFA
**Fields:** email/username, password; separate TOTP challenge after primary authentication.
**Actions:** Sign in; verify code; recover access through controlled recovery procedure.
**Behavior:** do not render admin data before backend role authorization and AAL2 are verified. No public admin registration. A customer cannot promote themselves through UI or user-editable metadata.
**States:** invalid credentials, MFA required, invalid/expired code, no enrolled factor, insufficient assurance, suspended admin, rate-limited.
**Requirement:** provide a secure MFA-enrollment/recovery process before enabling manager access.

### A2. Admin dashboard
**Cards:** total users, customer funds (only when a reconciled definition exists), total invested, returns credited, pending deposits, pending withdrawals, pending KYC, open risk alerts.
**Sections:** recent activity feed, withdrawal queue, KYC queue, deposit exceptions, reconciliation warnings.
**Buttons:** Open queue; filter by date/status; export only where authorized and audited.
**Behavior:** each count has a defined query and timestamp. Monetary totals must specify whether they represent ledger balances, provider-confirmed cash, or investment principal. Do not label unverified sums "customer funds."
**Empty/error:** show zero only after a successful query that confirms zero; otherwise show unavailable/error.

### A3. Users and user detail
**List:** user code, masked email/phone as policy allows, account status, KYC status, registration date, last activity where available.
**Actions:** search, filter, open profile, view account activity, restrict/suspend only with reason and backend workflow.
**Detail tabs:** profile, KYC status, investments, deposits, withdrawals, ledger summary, support, risk/compliance references.
**Rules:** sensitive personal data is minimized and audited. Never expose passwords, auth tokens, private document URLs, or full payment credentials.

### A4. KYC & Compliance
**Queues:** pending, action required, flagged, completed.
**Detail:** submitted evidence via short-lived access, verification provenance, risk flags, case history.
**Actions:** approve/reject/request more information/place permitted hold; every action requires reason and creates an audit event.
**Rules:** decisions are backend state transitions, not direct field edits. Separation-of-duties and regulatory review requirements must be configured before production.

### A5. Investments
**List:** investment reference, user code, plan/version, principal, currency, start/maturity, status.
**Detail:** terms accepted, event timeline, return calculation references, linked ledger transactions.
**Actions:** inspect, filter, export if authorized. Do not provide a button to edit historical principal or rewrite investment events.

### A6. Investment plans
**List fields:** name, version, currency, minimum/maximum, duration, disclosed return method/rate, active status, effective dates.
**Actions:** Create draft, edit draft, preview, submit/publish, activate/deactivate where permitted.
**Behavior:** published versions are immutable; changes create a new version with an effective date and audit record. Prevent activation without approved terms, risk disclosure, and validated calculations.
**Current capability:** mutation controls remain disabled until server-side plan-versioning endpoints and tests exist.

### A7. Returns / Profits
**Views:** calculation queue, calculation detail, posted return ledger entries, exceptions/reconciliation.
**Detail:** principal, plan version, period, applicable rate/method, fees/adjustments, formula, inputs, output, calculation version, approval/posting state.
**Actions:** recalculate preview; request review; approve/post only through an authorized transactional workflow.
**Rules:** deterministic engine; AI cannot decide amounts. Never overwrite a posted return—correct through a new, linked adjustment transaction with reason and approval.

### A8. Deposits
**List:** deposit reference, user code, amount/currency, provider, status, timestamps, provider reference masked as appropriate.
**Detail:** webhook/payment event timeline, signature verification result, idempotency key, reconciliation status.
**Actions:** inspect; reconcile; open exception. Manual resolution requires a dedicated audited backend workflow.
**Rules:** never credit because the UI or customer says payment succeeded.

### A9. Withdrawals
**Queue:** request reference, user code, amount/currency, eligibility, risk/hold indicator, request time, SLA.
**Detail:** ownership, available ledger balance, KYC result, maturity/schedule checks, destination (masked), risk decision, approval history, payment status.
**Actions:** Review; approve; reject; place/remove permitted hold; request more information. Require reason for rejection/hold and step-up MFA for sensitive approval.
**Behavior:** approval is not payment completion. Payment execution, provider confirmation, ledger posting and reconciliation are distinct states. No direct balance editing.

### A10. Treasury
**Cards:** provider/custody accounts, currency, confirmed balance as-of timestamp, ledger control balance, variance.
**Actions:** view account, reconcile, open variance case.
**Rules:** mask references and secrets. Customer funds must not be mixed with personal/operating funds. No transfer initiation until authorized custody/payment arrangements and dual-control rules are established.

### A11. Fund movements
**List:** movement reference, source/destination account class, amount/currency, status, initiator, approver, created time.
**Actions:** create proposal, review, approve only if a second authorization is configured, cancel before execution when allowed.
**Rules:** no movement may be executed solely by AI or by a single unchecked frontend action. Idempotency, limits, risk checks and full audit are mandatory.

### A12. AI Assistant
**Layout:** chat/query panel, cited internal record references, generated report panel, proposed-action queue.
**Allowed:** answer from authorized read services, summarize exceptions, explain a deterministic calculation, draft reports and propose actions.
**Disallowed:** independent transfers, arbitrary profit credits, direct ledger mutation, approval of its own proposal, bypassing KYC/compliance, hidden data access.
**Actions:** Ask; attach authorized record reference; create proposal; send proposal for manager review.
**Behavior:** AI output is advisory and labelled as such. Backend revalidates every proposed action; approvals and execution are separate steps. Log prompts/action metadata according to privacy policy.

### A13. Reports
**Reports:** user/account summary, investment and maturity schedule, ledger trial balance, returns, deposits, withdrawals, treasury reconciliation, compliance, audit.
**Controls:** date range, currency, status, export format, generate, download.
**Rules:** every report has an as-of timestamp, scope and definition. Exports are permission-checked and audit-logged; sensitive columns are omitted by default.

### A14. Risk / Alerts
**Queue:** severity, alert type, related record, created time, assigned reviewer, status.
**Actions:** open case, assign, add note, escalate, resolve with reason.
**Rules:** an alert is not itself proof of wrongdoing. Only authorized workflows can impose or lift restrictions; record evidence and decision rationale.

### A15. Audit Logs
**Columns:** event time, actor, role, action, entity type/reference, request/transaction reference, reason.
**Detail:** permitted before/after snapshots with sensitive fields redacted.
**Actions:** search/filter; export audited report if authorized.
**Rules:** append-only; no edit/delete UI. Every privileged action, approval, failed authorization and manual exception should be recorded without storing secrets.

### A16. Settings
**Sections:** investment-plan policy, withdrawal windows, limits, notification templates, security policy, provider integration health.
**Actions:** propose change, preview impact, submit for approval, view version history.
**Rules:** no unreviewed production policy changes. Record old/new values, actor, reason, effective time and approval.

### A17. Admin security
**Cards:** MFA status, active sessions, recent failed logins, security events.
**Actions:** enroll/verify MFA, revoke sessions, rotate supported credentials through secret manager, review alerts.
**Rules:** never display service-role keys, provider secrets or raw tokens in the UI.

## 5. Role and permission matrix

| Capability | User | Manager/Admin | Backend rule |
|---|---|---|---|
| View own profile/wallet/investments | Yes | Only for authorized support/management purpose | User ID bound to verified JWT; admin reads audited |
| View other users | No | Yes, limited by role and purpose | Admin API + trusted role + MFA |
| Submit KYC | Own account | Review queue | Workflow-controlled transitions |
| Create investment | Own account, when enabled | View/manage plans | Server validates terms, limits and balance |
| Edit published plan | No | New version only | Immutable published versions |
| Deposit | Create request | Review exceptions | Provider-confirmed webhook before credit |
| Request withdrawal | Own account | Review/approve if enabled | Server recomputes eligibility and balance |
| Approve withdrawal | No | Authorized manager workflow | MFA, policy, reason, audit, payment state machine |
| Change balance/ledger history | No | No direct edit/delete | Balanced immutable ledger and adjustment entries |
| View treasury | No | Authorized records only | Admin API, least privilege and audit |
| Move funds | No | Proposal/approval only when enabled | Transactional service, limits, dual control |
| AI action execution | No | AI may propose; manager reviews | AI cannot approve or execute independently |
| Change role | No | No self-service role escalation | Trusted server-side provisioning only |
| Read audit logs | No | Authorized manager | Append-only audit store, redaction |

## 6. Shared backend contract and non-functional requirements

- All mutating financial actions use server-side transactional functions; frontend cannot write ledger or financial state directly.
- Every mutation validates the authenticated identity, role, ownership, status transition, KYC/risk requirements, limits and idempotency key.
- Use integer minor units or PostgreSQL NUMERIC with explicit scale/currency rules; never floating-point arithmetic for money.
- Each completed ledger transaction balances debits and credits in one currency; cross-currency movement requires explicit FX legs/rate metadata.
- Use database transactions and locking/constraints to prevent concurrent double-spend.
- Payment webhooks are signature-verified, replay-safe and idempotent.
- Audit events are append-only and include actor, action, target, reason, timestamps, request/transaction reference and appropriately redacted before/after state.
- Never put service-role keys, provider secrets, raw identity documents or sensitive personal data in frontend bundles, logs or AI prompts.
- Admin and user APIs return only fields needed by that screen; no broad `select(*)`.
- API contracts need schema validation, bounded pagination, rate limits, stable error shapes and correlation IDs.
- User and Admin API responses use `Cache-Control: no-store` for account/financial data.
- All money movement remains disabled until backend transactionality, provider/custody setup, compliance and end-to-end tests are approved.

## 7. Implementation order and acceptance criteria

1. Route shells, separate login entry points, navigation, responsive layout, loading/empty/error components.
2. Wire read-only User API screens; verify account A cannot read account B.
3. Wire read-only Admin API screens; verify non-admin, wrong-role, and non-AAL2 sessions are denied.
4. Validate table/column assumptions against the deployed schema and add typed API response contracts.
5. Implement immutable ledger posting and deterministic return calculation with automated tests.
6. Implement provider-backed deposits, withdrawal eligibility and approval/payment state machines.
7. Implement KYC/compliance, notifications, reports, treasury reconciliation and AI read/proposal controls.
8. Run unit, integration, RLS, authorization, concurrency, idempotency, reconciliation and responsive-device tests.
9. Deploy only after CI passes and verify the actual production User and Admin entry points.

### Release acceptance checklist
- [ ] User and Admin have distinct shells and login entry points.
- [ ] Admin navigation never appears in the User application.
- [ ] No user can self-assign a privileged role.
- [ ] Admin API requires trusted role and verified MFA.
- [ ] User endpoints enforce ownership server-side.
- [ ] Frontend contains no service-role or provider secret.
- [ ] Financial mutations cannot bypass the core transactional service.
- [ ] Every completed ledger transaction balances and cannot be silently edited/deleted.
- [ ] Replayed payment webhooks do not duplicate credits.
- [ ] Withdrawal approval and payment completion are distinct states.
- [ ] Real production data is shown only when verified; otherwise the UI says unavailable.
- [ ] Production deployment, routes and authorization tests are independently verified.
