# Supabase schema and migration reconciliation report

Project: `rjgzvpkyccfpnpzlbcuc` (Invest Broker)

## Scope and safety

This is a read-only schema inspection and repository recovery report. No production SQL was applied and no production migration history was changed.

## Live migration history

Supabase reports these 15 applied migration versions:

- `20261010055354` — `invest_broker_shared_platform_foundation`
- `20261010055614` — `invest_broker_user_portal_support_features`
- `20261010055730` — `invest_broker_notification_read_state`
- `20261010060308` — `invest_broker_double_entry_ledger`
- `20261010060317` — `invest_broker_ledger_posting_guard`
- `20261010133726` — `invest_broker_account_approval_gate`
- `20261010133851` — `invest_broker_single_admin_control`
- `20261010133958` — `invest_broker_atomic_account_review`
- `20261010201831` — `bootstrap_single_primary_admin`
- `20261011171226` — `phase_2_realtime_admin_customer_updates`
- `20261011221255` — `platform_control_deny_client_access`
- `20261011221826` — `ledger_posting_requires_all_pending_lines`
- `20261012104812` — `payment_provider_test_scaffold`
- `20261012155617` — `deny_browser_access_payment_provider_tables`
- `20261015002132` — `revoke_api_access_from_foreign_table`

## Live schema snapshot (catalog metadata)

Read-only catalog inspection found 20 ordinary public tables and one public foreign table. The ordinary tables are:

- `profiles`, `wallets`, `investment_plans`, `investments`
- `ledger_accounts`, `ledger_entries`, `ledger_transactions`
- `deposits`, `withdrawals`, `treasury_accounts`, `audit_logs`
- `support_messages`, `compliance_cases`
- `user_bank_accounts`, `user_notifications`, `user_documents`, `user_complaints`
- `platform_control`, `payment_provider_registry`, `payment_intents`

The foreign table is `public."Invest-broker c"`. RLS is enabled on the inspected public ordinary tables. Catalog inspection also found append-only triggers for audit logs and ledger records, policies restricting client access to platform control and payment-provider tables, and the `review_customer_account` security-definer function.

A focused permission query verified that roles `anon` and `authenticated` currently do not have SELECT privilege on `public."Invest-broker c"`, matching the intent of migration `20261015002132`.

This snapshot describes current catalog state; it is not a full portable database dump and does not reproduce historical SQL or external foreign-server credentials.

## Repository recovery

The main branch's `supabase/migrations/` folder originally contained only the final foreign-table revocation migration.

The following three original SQL files were recovered from branch `feature/platform-foundation` with exact matching migration version and filename, and restored without rewriting their SQL:

- `20261010055354_invest_broker_shared_platform_foundation.sql`
- `20261010060308_invest_broker_double_entry_ledger.sql`
- `20261010060317_invest_broker_ledger_posting_guard.sql`

Source branch files were inspected before copying. Their content hashes were respectively `aa5b2fa825abda67f9800a657c207cd9408d885f`, `0e4ac76def957250413f6939292f9a0791f5707e`, and `b3e85bfea3c004aa6db35bdafc8604dd482bf4c8`.

The following source files also exist on `feature/platform-foundation`, but their timestamps do not match the applied Supabase migration versions. They have not been renamed or restored as historical versions because that would falsely assert an unverified mapping:

- `20261010062000_invest_broker_user_portal_support_features.sql` (live history records version `20261010055614`)
- `20261010_bootstrap_primary_admin.sql` (live history records `20261010201831_bootstrap_single_primary_admin`)
- `20261011221200_platform_control_deny_client_access.sql` (live history records `20261011221255`)
- `20261011222000_ledger_posting_requires_all_pending_lines.sql` (live history records `20261011221826`)
- `20261012115000_payment_provider_test_scaffold.sql` (live history records `20261012104812`)
- `20261012161000_deny_browser_access_payment_provider_tables.sql` (live history records `20261012155617`)

GitHub's commit history query for each exact missing historical path returned no commits. Searches also did not recover the original SQL for these five live versions:

- `20261010055730_invest_broker_notification_read_state`
- `20261010133726_invest_broker_account_approval_gate`
- `20261010133851_invest_broker_single_admin_control`
- `20261010133958_invest_broker_atomic_account_review`
- `20261011171226_phase_2_realtime_admin_customer_updates`

Thus four of the 15 applied versions now have exact-name SQL in the recovery branch (the three recovered files plus the existing final migration), while eleven historical SQL files remain unverified or missing. The migration-integrity check is intentionally expected to fail until the full sequence is recovered.

## Test and deployment status

- Full migration-chain replay: BLOCKED until all 15 exact historical migration files are recovered and reviewed.
- Isolated replay of the three exact-version recovered migrations: can be run as a subset test, but is not proof that the full production history replays.
- Production migration deployment: manual-only, protected GitHub Environment, dry-run before apply. Production deploy must remain disabled until recovery is complete and a reviewer approves.
- No SQL was applied to production during this reconciliation.
