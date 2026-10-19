# Invest Broker deployment hold — 2026-10-15

## Current state

- GitHub source of truth: `Cyrrenza-v2/Invest-broker`, default branch `main`, inspected head `6152bde1645594c87bcaacc5841fc2d594714e85`.
- Supabase project `rjgzvpkyccfpnpzlbcuc` reports `ACTIVE_HEALTHY`; the five active Edge Functions and their deployed source were copied into this branch under `supabase/functions/`.
- The GitHub frontend source uses `src/main.ts` and its registration flow reads the full name from submitted form data. The separate AppDeploy customer-portal snapshot uses `src/App.tsx` and still has the build error `Cannot find name 'fullName'`; that AppDeploy snapshot is not currently a file in this repository, so its error should not be claimed fixed by this GitHub source sync.
- AppDeploy reported its daily free-tier deployment limit resets at `2026-10-16T00:00:00Z` (01:00 Nigeria time). No AppDeploy deployment was attempted as part of this branch.

## Hold instructions

1. Keep this work on the sync branch until the deployment-credit reset and review.
2. Do not deploy AppDeploy before the reported reset.
3. After reset, patch the separate AppDeploy snapshot by adding state declarations for `fullName`, `phone`, `register`, and `menuOpen`, then run build and QA before attempting a deployment.
4. Before merging Supabase changes, reconcile the migration history: the live project reports 15 applied migrations, while the current Git tree contains only four SQL migration files and the migration workflow expects all 15. Do not fabricate missing historical SQL; recover the exact originals or approve a separately reviewed baseline strategy.
5. Never commit service-role or provider secrets. The Supabase sources here reference environment variables only.

This branch is a source-preservation step. It does not change the live Supabase functions, alter production data, merge to `main`, or trigger the main-branch deployment workflows.
