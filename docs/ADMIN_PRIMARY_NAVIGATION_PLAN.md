# Invest Broker admin navigation plan

## Operating assumption

Invest Broker is operated by one authorized administrator. The interface should optimize for one-person daily operations, not a multi-department staff workflow. Keep the existing trusted admin role, verified MFA, server-side authorization, and audit trail; do not remove security checks just because there is one operator.

## Four primary admin sections

### 1. Dashboard — first landing screen
One overview, not a collection of disconnected pages:
- Customer and staff counts shown separately; staff count should normally identify the single authorized operator.
- Total recorded investments, active/pending/completed/lost statuses where supported.
- Deposit and withdrawal queues with pending counts and direct links to review.
- Profit credits and loss records from the financial ledger, with period filters.
- Customer USD wallets and company treasury balances shown separately; admin treasury may show USD and NGN as separate currencies without conversion.
- KYC/compliance queue, latest audit events, system health, and stale/missing-data warnings.
- Every metric must be sourced from authorized APIs. Do not show invented zeros or claim a service is healthy if its status was not checked.

### 2. Users & Staff
- Search customers by name, email, customer code, or account status.
- Open a customer detail view with profile, approval state, KYC state, wallet ledger, investment history, deposits, withdrawals, and posted profit/loss entries.
- Approve/reject eligible account applications with a reason and audit record.
- Staff/administrator role management is restricted to trusted server-side controls; never expose self-service role escalation.
- Keep customer and staff records visibly distinct.

### 3. Investment & Transactions
- Investment plans: create/edit/pause plans, with validation and a review summary before saving.
- Investment book: inspect investor, principal, plan, start/maturity dates, status, and supporting ledger entries.
- Deposits: review provider-confirmed evidence and approve/reject requests; never credit a deposit based only on a submitted form.
- Withdrawals: validate available ledger balance, eligibility, approval and settlement before release.
- Profit/loss management: post only authorized, auditable ledger entries with investor, amount, currency, period, source/reason, and idempotency protection.
- All actions should return clear pending/success/failure states and require confirmation for financial mutations.

### 4. Operations & Settings
Use internal tabs/sections instead of expanding the primary sidebar:
- Treasury (company funds, separate from customer wallets)
- KYC/AML and compliance
- Reports and export
- Audit log
- AI Assistant (advisory/read-only; cannot post money movement)
- Security and platform settings, integrations, and payment-provider health

## Navigation behavior
- Desktop: compact four-item sidebar with a clear active state.
- Mobile: collapsible sidebar or compact bottom/overflow navigation; never show 15 equal-weight primary links.
- Every detail screen has a consistent Back-to-parent path, search/filter persistence where practical, and no dead-end navigation.
- Dashboard alerts link directly to the relevant queue or customer record.
- Use confirmation dialogs for irreversible or financial actions and show the resulting audit reference.
- Use explicit loading, empty, error, stale-data, and permission-denied states.

## Release and safety gates
1. Verify route-level role separation and admin MFA/AAL2.
2. Test each screen against the real protected admin API and RLS/edge-function permissions.
3. Verify every mutation has server-side authorization, audit logging, idempotency where relevant, and no browser-side direct ledger writes.
4. Run unit/type checks, build, route/navigation smoke tests, and authenticated E2E tests with test accounts.
5. Keep live money movement disabled until provider settlement, reconciliation, duplicate-event, refund/reversal, and recovery tests pass.

This is a navigation and interaction plan. It is not a claim that all listed backend actions or payment integrations are currently implemented.
