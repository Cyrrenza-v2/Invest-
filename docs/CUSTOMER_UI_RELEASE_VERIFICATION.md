# Customer UI implementation and release verification

## Scope
The existing app is a TypeScript/Vite single-page application with customer routes and a separately configured admin role. This change improves responsive behavior and accessibility without changing authentication, backend authorization, ledger behavior, or payment processing.

## Customer screens to verify
- Welcome and customer registration/login
- Dashboard and USD-only wallet presentation
- Published investment plans and customer investment history
- Deposit and withdrawal request/history states
- Transactions and notifications
- KYC/documents, profile, security, and support
- Session persistence, logout, and approval/suspension gates

## UI acceptance criteria
- Navigation remains usable on narrow Android screens and tablets.
- Touch targets are comfortable to tap; keyboard focus is visible.
- Tables can scroll horizontally instead of breaking the page layout.
- Safe-area padding is respected on installed PWAs.
- Reduced-motion preferences are honored.
- Financial values are sourced from authenticated backend records; the UI must not fabricate balances, profits, payment success, or approval outcomes.
- Customer and admin roles remain isolated by backend authorization, not merely by hidden navigation.

## Required release test evidence
1. pnpm install --frozen-lockfile
2. pnpm run build
3. pnpm run test:worker
4. Run both deployed app URLs and verify the deployed commit matches the tested commit.
5. With dedicated test accounts, verify customer auth and admin auth/role separation.
6. Exercise a safe customer request and confirm it appears in the admin view with backend persistence and audit evidence.
7. Verify real-time update delivery and reconnect behavior.
8. Verify payment providers remain test-only and no production money movement is enabled.
9. Resolve the documented Supabase migration-history mismatch before production certification.
10. Test installed Android PWA behavior on phone and tablet.

## Current limitations
This UI change does not reconstruct missing historical database migrations, does not run a browser/device end-to-end suite, does not configure missing production secrets, and does not build signed Android APKs. A Vercel deployment marked READY is not sufficient evidence for end-to-end correctness. Do not describe the release as production-ready until the required evidence above is recorded.
