# Invest Broker — User / Admin / Secure Core Separation
Version 1.0 | Status: Architecture baseline | Updated 2026-10-10

This document complements `docs/MASTER_TECHNICAL_SPECIFICATION.md` and `docs/SCREEN_SPECIFICATION.md`. It defines the explicit boundary between the customer platform, the private manager platform, and the shared secure core. It is an architecture contract, not evidence that all listed features are implemented or deployed.

## 1. Trust boundaries

```
CUSTOMER BROWSER                         MANAGER BROWSER
User frontend                            Admin frontend
User auth storage key                    Admin auth storage key
       |                                        |
       v                                        v
Customer API boundary                    Admin API boundary
       |                                        |
       +------------------+---------------------+
                          v
                 SHARED SECURE CORE
        Auth/session checks • RBAC • policy engine
        Ledger • wallet • investments • returns
        deposits • withdrawals • KYC • compliance
        notifications • reports • AI tools • audit
                          |
                          v
                PostgreSQL / Supabase
          RLS • constraints • transactions • audit
                          |
                          v
         Approved payment/custody/provider systems
```

Both applications may use the same Supabase Auth project and database, but they are not trusted peers. The server is the enforcement point. Client-side route guards are usability controls only.

## 2. Customer platform scope

### Authentication
- Welcome, register, login, verify contact, forgot/reset password, configured OTP/MFA, recovery.
- No role selection during registration. New self-registered accounts are always customers.
- Profile completion and KYC progression are explicit states; successful authentication alone does not imply KYC approval or investment eligibility.
- Recovery endpoints must avoid account enumeration, apply rate limits, and notify on security-sensitive changes.

### Customer routes
`/login`, `/register`, `/verify`, `/forgot-password`, `/reset-password`, `/dashboard`, `/profile`, `/kyc`, `/investments`, `/investments/:id`, `/wallet`, `/deposit`, `/withdraw`, `/transactions`, `/notifications`, `/support`, `/security`, `/statements`.

### Customer-visible financial data
- Balance values are labelled as available, held/pending, invested, accrued/projected return, and posted/credited return.
- Only backend-derived, own-account data is displayed. No customer can select an arbitrary user ID to view another account.
- A deposit is credited only after provider/backend verification. An investment is created only by a server-authorized transaction. A withdrawal request does not itself prove payment.
- Any action not connected to a tested backend workflow must be disabled and clearly identified as unavailable.

## 3. Admin/manager platform scope

### Authentication and provisioning
- Dedicated `/admin/login`; no public admin registration.
- Admin/manager role is granted only by a controlled server-side provisioning process, never from user-editable metadata or a registration form.
- Require valid authentication, active account/session, trusted role, explicit permission and verified MFA assurance before sensitive admin data or actions.
- Target routes: `/admin/login`, `/admin/dashboard`, `/admin/users`, `/admin/users/:id`, `/admin/kyc`, `/admin/investments`, `/admin/investment-plans`, `/admin/returns`, `/admin/deposits`, `/admin/withdrawals`, `/admin/treasury`, `/admin/fund-movements`, `/admin/compliance`, `/admin/risk`, `/admin/support`, `/admin/ai`, `/admin/reports`, `/admin/audit`, `/admin/settings`, `/admin/security`.
- The current repository has a separate Vite `admin.html` entry point. Direct routes, refresh behavior and hosting rewrites must be implemented and tested before asserting that every target route works.

### Admin functions
- Dashboard: aggregate operational metrics with currency, date range, freshness and reconciliation indicators.
- User/KYC: scoped record review and recorded decisions.
- Investment plans/returns: versioned terms, effective dates, review and audit; no silent retroactive rule edits.
- Deposit/withdrawal queues: investigation, review and approved workflows only; no direct table mutation from browser.
- Treasury/fund movements: distinguish customer/custody funds, provider clearing and company operating funds.
- AI: read-only authorized analysis and drafts; no autonomous approvals, SQL, ledger mutation or payment execution.
- Reports/audit/security/support: permission-gated, logged, privacy-minimized access.

## 4. Session separation and limitations

The current frontend client keys are intended to be:
- Customer: `invest-broker-user-auth-v1`
- Admin: `invest-broker-admin-auth-v1`

Separate storage keys reduce accidental session collision in a browser; they do not create separate identity providers and do not guarantee complete isolation against same-origin script compromise. The current apps use a shared Supabase Auth project. The backend must validate every access token and permission independently. Evaluate stronger origin isolation (for example, a dedicated admin subdomain) before production.

Admin controls required before production:
- Authenticator MFA enrollment, challenge, recovery and revocation.
- AAL2/verified MFA check on protected endpoints, not just in React.
- Shorter admin session policy, active session/device review and revocation.
- Rate limiting, login alerts, security event audit and step-up authentication for sensitive actions.
- Role removal/session revocation strategy and tests for stale JWT claims.

## 5. Permission contract

Permissions should be explicit grants rather than implied by a route. Initial permission names:
- `users.read`, `users.manage_status`
- `kyc.read`, `kyc.review`
- `investments.read`, `investment_plans.propose`, `investment_plans.approve`
- `returns.read`, `returns.propose_adjustment`, `returns.approve_adjustment`
- `deposits.read`, `deposits.review`
- `withdrawals.read`, `withdrawals.review`, `withdrawals.approve`, `withdrawals.execute`
- `treasury.read`, `fund_movements.propose`, `fund_movements.approve`, `fund_movements.execute`
- `compliance.read`, `compliance.review`, `risk.read`, `support.manage`
- `reports.read`, `reports.export`, `audit.read`, `settings.manage`, `security.manage`, `ai.query`

Every action checks a server-side permission, record scope, account state, MFA level where required, input schema, limits and workflow state. Sensitive movement should use maker-checker separation where practical. No one permission should imply all other permissions.

## 6. Shared secure core API boundary

Customer API namespace (logical contract):
- `GET/PATCH /api/me`
- `GET /api/me/wallet`, `GET /api/me/transactions`
- `GET /api/me/investments`, `GET /api/me/investments/:id`
- `POST/GET /api/me/deposits`
- `POST/GET /api/me/withdrawals`
- `GET /api/me/notifications`, `POST /api/me/notifications/:id/read`
- `GET/POST /api/me/kyc`
- `GET/POST /api/me/support/tickets`
- `GET /api/me/statements`

Admin API namespace:
- `GET /api/admin/dashboard`
- `GET /api/admin/users`, `GET /api/admin/users/:id`
- `GET/POST /api/admin/kyc/reviews`
- `GET/POST /api/admin/investment-plans`
- `GET /api/admin/investments`, `GET /api/admin/returns`
- `GET /api/admin/deposits`, `POST /api/admin/deposits/:id/review`
- `GET /api/admin/withdrawals`, `POST /api/admin/withdrawals/:id/approve`, `POST /api/admin/withdrawals/:id/reject`
- `POST /api/admin/withdrawals/:id/execute` (feature-gated until payout provider/custody, approval and reconciliation controls are approved)
- `GET /api/admin/treasury`, `GET /api/admin/reconciliation`
- `GET /api/admin/compliance`, `GET /api/admin/risk`
- `GET /api/admin/reports/:type`, `GET /api/admin/audit`, `GET/PATCH /api/admin/settings`
- `POST /api/admin/ai/query` (read-only allowlisted tools only)

These are intended contracts; they are not claims that all routes currently exist. Each endpoint needs request/response schemas, explicit permission, status/error contract, idempotency semantics, audit behavior and positive/negative tests.

## 7. Shared financial rules

- No frontend directly edits balances, ledger entries, investment state, provider payment state or audit records.
- All mutations run through trusted server/database transactions with constraints, idempotency, concurrency controls and audit records.
- Journal entries balance per currency. Posted entries are not edited/deleted; use linked reversals.
- Pending provider events do not create spendable funds. Validate provider authenticity, amount, currency, reference and duplicate/replay status.
- Withdrawal requests reserve eligible funds atomically. Execution is disabled until an approved regulated provider/custody arrangement and reconciliation workflow exist.
- Return projections/accruals are not the same as posted, available cash. Only an approved deterministic posting workflow can credit returns.
- AI cannot grant itself permissions, bypass KYC, approve its own recommendation, or move money.

## 8. Data domains

Existing foundation migration has been reported to create `profiles`, `wallets`, `investment_plans`, `investments`, `ledger_entries`, `deposits`, `withdrawals`, `support_messages`, `compliance_cases`, `treasury_accounts`, and `audit_logs`. Verify actual live schema and policies before relying on columns or assuming newer tables exist.

Additional entities to assess/implement as justified: KYC profiles/documents/events; versioned plan terms and investment events; ledger accounts and journal transactions; holds/reservations; provider webhook/idempotency records; payout and settlement records; notifications/outbox; support tickets; risk alerts; permission grants; session/device security events; reconciliation runs/exceptions.

All exposed tables require RLS with real ownership predicates; authorization must not use user-editable metadata. Private KYC files require private storage policies and short-lived authorized access. Privileged database functions require review and minimal grants.

## 9. Acceptance test matrix

| Scenario | Expected result |
|---|---|
| Unauthenticated visitor opens customer dashboard | Redirect to customer login |
| Customer opens admin URL | Admin login or forbidden page; no protected data |
| Customer calls admin API directly | 403; no side effects |
| Admin without verified MFA calls protected endpoint | Denied |
| Customer changes user ID in request | Own data only / otherwise denied |
| User edits metadata to claim manager | No privilege change |
| Suspended user/admin calls protected endpoint | Denied |
| Customer signs out | Customer session cleared without accidentally clearing the admin key; test both sessions independently |
| Duplicate deposit webhook | One credit at most |
| Client fabricates payment-success redirect | No credit |
| Concurrent withdrawals exceed available funds | At most eligible amount reserved |
| Failed payout is retried | No duplicate payout; reconciliation controls apply |
| AI recommends approval | No financial action until human-authorized backend workflow |
| Audit record modification attempted | Denied; corrections use controlled process |
| Direct route refresh on every target URL | Correct page or safe fallback, no authorization bypass |

## 10. Delivery gates

1. Verify current repository and actual Supabase schema/policies.
2. Implement route split and secure API boundaries.
3. Complete MFA enrollment/recovery and server-side authorization.
4. Implement/test accounting invariants and idempotency.
5. Implement provider sandbox integrations and reconciliation.
6. Complete screens against `docs/SCREEN_SPECIFICATION.md`.
7. Pass automated, security and financial reconciliation tests.
8. Verify staging deployment and recovery procedures.
9. Obtain qualified legal/compliance and operational sign-off.
10. Enable production financial operations only after all gates are approved.

**Status discipline:** documentation, committed code, passing CI, deployed frontend, verified backend, and production readiness are different milestones. Never report one as proof of another.
