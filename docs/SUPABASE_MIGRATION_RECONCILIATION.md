# Supabase migration-history reconciliation

Project: `rjgzvpkyccfpnpzlbcuc`

## Verified issue

The live Supabase migration history contains versions that are not represented by matching migration files on `main`. A filename timestamp is part of the migration version; changing a filename does not recreate the SQL of a missing historical migration.

## Corrected in this branch

- The foreign-table access revocation migration is named with the version recorded by Supabase: `20261015002132_revoke_api_access_from_foreign_table.sql`.
- The prior mismatched file `20261015010000_revoke_foreign_table_api_access.sql` is removed to avoid presenting the same operation as a different, unapplied version.

## Still blocking a complete reconciliation

The following live versions were reported by Supabase but their original SQL files were not found on the inspected Git branches:

- `20261010055730_invest_broker_notification_read_state`
- `20261010133726_invest_broker_account_approval_gate`
- `20261010133851_invest_broker_single_admin_control`
- `20261010133958_invest_broker_atomic_account_review`
- `20261011171226_phase_2_realtime_admin_customer_updates`

Several other historical migrations are present only under different timestamps on `feature/platform-foundation`. Those need to be compared against the live schema and history before mapping or restoring them.

## Safe completion procedure

1. Recover the original migration SQL from repository history, a verified database backup, or an exported schema plus audited change records.
2. Compare every recovered migration's intended DDL and policies with the live database. Do not blindly replay already-applied DDL.
3. Restore historical files under the exact recorded versions only when the SQL identity is verified; otherwise create a clearly named forward-reconciliation migration for a verified schema delta.
4. Run the migration-history check and migration dry-run against a disposable Supabase branch first.
5. Apply only reviewed forward migrations to production, then verify `supabase_migrations.schema_migrations` and run application/ledger security tests.

Do not insert empty placeholder migrations, disable migration checks, or reset production migration history to make CI green. No production schema or migration history should be changed merely to silence the mismatch.
