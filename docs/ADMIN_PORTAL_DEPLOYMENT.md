# Admin Portal Deployment Checklist

## Purpose
Deploy the admin portal as a separate Vercel project without changing the existing customer deployment.

## Vercel project settings
- Repository: `Cyrrenza-v2/Invest-broker`
- Project name: `invest-broker-admin`
- Framework preset: Vite
- Build command: `npm run build`
- Output directory: `dist`
- Environment variable: `VITE_APP_ROLE=admin`
- Production branch: `main` (or the approved release branch)

The existing frontend selects the admin presentation at build time through `VITE_APP_ROLE`. The customer project must retain its own user-role build configuration.

## Important release gate
The current `src/main.ts` implementation uses browser `localStorage` and seeded demo accounts. The admin welcome screen states that the preview is not connected to production authentication or real money. Therefore, a successful Vite build is **not** proof that the admin app is production-ready.

Do not use demo credentials for real operations, and do not enable deposits, withdrawals, treasury changes, or ledger mutations until:
1. Admin identity and role are verified server-side on every privileged API request.
2. Admin endpoints use the production Supabase project and enforce authorization/RLS.
3. User and admin sessions cannot cross portal boundaries.
4. Ledger mutations are server-authorized, idempotent, and audited.
5. End-to-end tests verify admin access denial for ordinary users and customer access denial for admin-only actions.

## Current deployment blocker
Project creation through the connected Vercel integration returned HTTP 403 (insufficient permission). This is an account/team permission blocker, not a build error. Once project creation is permitted, use the settings above and verify the deployment's READY state and commit SHA before publishing its URL.

## Release verification
- [ ] Separate Vercel project created and linked to this repository
- [ ] Admin environment variable configured only on the admin project
- [ ] Production deployment is READY and points to the approved commit
- [ ] Admin login and server-side role checks pass
- [ ] Admin data loads from Supabase rather than browser seed data
- [ ] Privileged operations are blocked until backend and ledger tests pass
- [ ] Installable PWA manifest/service worker and app name verified for admin
- [ ] Customer production URL remains unchanged
