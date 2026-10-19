# Invest Broker — Implementation Gap Assessment
Assessment date: 2026-10-10
Repository: `Cyrrenza-v2/Invest-broker`
Branch inspected: `feature/platform-foundation`
Supabase project inspected: `rjgzvpkyccfpnpzlbcuc`

## Scope and confidence
This is a read-only snapshot of the connected repository and Supabase project. It is not a penetration test, financial audit, legal approval, or production deployment verification. Findings below are limited to the current files and live metadata inspected.

## Verified current state

### Repository
- Customer frontend: `src/main.jsx`; uses `user-api` for reads and support-message creation. The inspected file contains zero direct `.from(...)` table calls.
- Admin frontend: `src/admin.jsx`; uses `admin-api` for reads. The inspected file contains zero direct `.from(...)` table calls.
- The customer and admin Supabase client configurations use different storage keys: `invest-broker-user-auth-v1` and `invest-broker-admin-auth-v1`.
- Admin UI checks for trusted `app_metadata.role` values `admin` or `manager`, and checks MFA assurance in the UI. The backend independently checks the role and AAL2 for Admin API requests.
- These facts establish an architectural start, not full feature completion or deployment verification.

### Live Supabase project
- Project ref: `rjgzvpkyccfpnpzlbcuc`.
- Live Edge Functions: `user-api` version 2 and `admin-api` version 2; both are ACTIVE and have JWT verification enabled.
- Live migration history contains five migrations:
  - `20261010055354_invest_broker_shared_platform_foundation`
  - `20261010055614_invest_broker_user_portal_support_features`
  - `20261010055730_invest_broker_notification_read_state`
  - `20261010060308_invest_broker_double_entry_ledger`
  - `20261010060317_invest_broker_ledger_posting_guard`
- Seventeen public tables were listed; RLS is enabled on all 17: profiles, wallets, investment_plans, investments, ledger_entries, deposits, withdrawals, support_messages, compliance_cases, treasury_accounts, audit_logs, user_bank_accounts, user_notifications, user_documents, user_complaints, ledger_accounts, ledger_transactions.
- Table listing returned zero rows for each of these 17 tables. This indicates no rows in those public tables at the time of inspection, not necessarily that Auth has no users.
- Supabase security advisor returned an empty lint list. This is useful but does not prove all authorization, financial, or application-level controls are correct.

## Confirmed high-priority gaps

### P0 — Financial mutation workflows are not implemented in the inspected APIs
- `user-api` allows GET plus a POST path for creating support messages. Other POST requests return “This action is not enabled.”
- `admin-api` is GET-only and returns 405 for other methods with an explicit message that admin writes remain disabled.
- Consequently, the blueprint's investment creation, deposit request/confirmation, withdrawal request/approval/rejection/execution, investment-plan publishing, KYC decisions, and fund movement workflows must not be represented as operational yet.
- Preserve this fail-closed state until transactional functions, provider verification, idempotency, permissions, approvals, and reconciliation are implemented and tested.

### P0 — Admin read authorization needs a full policy and field review
- The Admin API validates the bearer token, trusted role, and AAL2 before reading privileged records.
- The inspected implementation allows the admin/manager role to query broad record sets across several tables, with optional `user_id` filtering on selected resources. It does not show fine-grained per-permission checks for every route.
- Add an explicit permission matrix, record scopes, field-level minimization, pagination/filter validation, and negative authorization tests before production use. A role check alone is not a complete least-privilege model.

### P1 — User dashboard and account workflows are partial
- The user API currently exposes own-profile, wallet, investment-plan, investments, ledger-entry, deposit, withdrawal, and support-message reads, plus support-message creation.
- The inspected API does not provide complete backend workflows for profile updates, KYC submission/review, bank-account management, deposit initiation/confirmation, investment creation, withdrawal requests, notification read/update operations, account recovery management, or statement export.
- Confirm the actual UI states and buttons against each API response; unsupported actions should remain disabled or clearly marked unavailable.

### P1 — Admin screens exceed the available API contract
- The admin API currently exposes dashboard aggregates and reads for users, investments, investment plans, ledger entries used as returns, deposits, withdrawals, compliance cases, treasury accounts, and audit logs.
- Full KYC document review, per-user detail aggregation, risk alerts, support ticket management, reconciliation runs/exceptions, fund movement workflows, permission administration, notifications, and report exports are not established by the inspected route map.
- AI Manager Assistant remains a read-only placeholder unless a separate secured, allowlisted AI implementation is verified.

### P1 — Route and deployment checks still required
- The repository uses a separate Vite `admin.html` entry. Verify intended `/admin/login` and `/admin/*` deep links, refresh behavior, production rewrite rules, and that customer/admin route guards fail closed.
- Production Vercel deployment and environment variables were not verified in this assessment. Do not treat the known URL as evidence that the latest branch is deployed.
- Run CI and endpoint smoke tests against the actual deployment before claiming completion.

### P1 — Financial and operational controls to prove
- Test double-entry posting invariants, per-currency balancing, immutable posted entries, reversal-only corrections, transaction atomicity, concurrent reservations, idempotency and duplicate webhook rejection.
- Review every privileged SQL function, grants, triggers, RLS predicates and private Storage policies, especially for KYC documents.
- Implement and test provider webhook signature verification, deposit reconciliation, payout idempotency, failure recovery, audit logging and maker-checker separation.
- Keep return posting, real payments, withdrawals and fund transfers disabled until approved provider/custody arrangements and legal/compliance requirements are satisfied.

## Recommended implementation order

1. Build a route-by-route UI/API contract matrix and ensure every button is backed by a real endpoint or visibly disabled.
2. Add explicit server-side permissions and resource scopes to Admin API; test wrong-role, missing-MFA, stale-session, suspended-account and cross-user access denials.
3. Finish account/profile/KYC and private document-storage workflows.
4. Implement ledger-backed investment creation as one atomic server transaction with idempotency and concurrency protections.
5. Implement deposit request/provider callback verification and reconciliation in provider sandbox.
6. Implement withdrawal eligibility/reservation, maker-checker review, payout adapter, failure recovery and reconciliation in sandbox only.
7. Finish notifications, support tickets, statements/reports, audit views and read-only AI tools.
8. Test routes, accessibility, mobile layouts, CI, staging deploy, backup restore and operational alerts.
9. Complete qualified legal/compliance review before enabling production financial operations.

## Release rule
Documentation, committed code, deployed Edge Functions, passing CI, verified frontend deployment, and production readiness are distinct milestones. No real-money operation should be enabled based on this assessment alone.
