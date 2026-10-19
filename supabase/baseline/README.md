# Fresh-environment schema baseline (recovery plan)

## Why this exists

The live Invest Broker database records 15 applied migrations, but Git currently contains only a subset of the exact historical SQL files. The missing files must not be recreated from guesses or by renaming migrations from other branches. The live database must not be reset or replayed to repair this repository gap.

## Required baseline procedure

1. Preserve the recorded production migration history and keep production migration/deploy jobs disabled.
2. Recover the exact original SQL from repository history/backups if possible. Exact originals remain preferred.
3. If originals cannot be recovered, export a **schema-only** snapshot from the live project using the Supabase CLI/database tooling into a separately named fresh-environment baseline. Do not export customer rows, auth users, secrets, or payment data.
4. Review the snapshot for tables, views, sequences, constraints, indexes, triggers, functions, grants, RLS enablement and policies, extensions, and realtime publication membership. Verify that it includes the protections added by the later recorded migrations.
5. Replay the baseline from an empty isolated local database, run schema lint/security checks, and compare the resulting catalog against a read-only schema inventory of the live project.
6. Keep the baseline separate from the historical migration directory and label it **fresh-environment-only**. Do not insert a fake historical migration version or mark the missing migrations as recovered.
7. Only after review, change CI to use the baseline path for fresh environments. Keep any production database mutation/deployment disabled until separately reviewed and explicitly authorized.

## Current gate

The workflow intentionally fails the historical-integrity check while original SQL is missing. The three exact-version recovered migrations pass isolated replay, but that is not evidence that the entire schema can be recreated. This gate must not be weakened to make CI green.

## Current verification

The live migration ledger lists these 15 versions: 20261010055354, 20261010055614, 20261010055730, 20261010060308, 20261010060317, 20261010133726, 20261010133851, 20261010133958, 20261010201831, 20261011171226, 20261011221255, 20261011221826, 20261012104812, 20261012155617, 20261015002132.

No production SQL was applied as part of this recovery work.


## Read-only export helper

The manual workflow `.github/workflows/supabase-schema-snapshot.yml` can create a short-lived schema-only review artifact without applying SQL:

1. In GitHub repository Settings → Secrets and variables → Actions, add a repository secret named `SUPABASE_DB_URL` containing the project's direct Postgres connection URL. Never paste it into chat, commit it, or put it in workflow YAML.
2. Open Actions → **Export read-only Supabase schema snapshot** → Run workflow on `chore/rebuild-ci-stack`.
3. Download the `invest-broker-public-schema-review` artifact and review it for completeness and dependencies before constructing a fresh-environment baseline.
4. The artifact expires after three days. It is not automatically committed or applied to any database.

This helper exports only the `public` schema and requests no application rows. It is a review input, not proof of a complete Supabase environment: managed schemas, extensions, roles, and cross-schema dependencies still need validation. The workflow is manual-only and has no database mutation step.
