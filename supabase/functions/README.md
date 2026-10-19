# Supabase Edge Functions

These function sources were copied from the currently active Invest Broker Supabase project `rjgzvpkyccfpnpzlbcuc` on 2026-10-15 so the repository can serve as the source-of-truth archive while the customer portal deployment is paused.

| Function | Captured deployed version | Purpose |
|---|---:|---|
| `user-api` | 11 | Authenticated customer profile and account data; financial mutations remain disabled except support submission |
| `admin-api` | 17 | Restricted admin data and audited customer approval workflow |
| `admin-bootstrap` | 8 | Primary-admin bootstrap guard |
| `admin-ai` | 8 | Advisory-only admin AI endpoint |
| `payment-api` | 3 | Payment intent and provider verification scaffold; do not enable real-money crediting until provider verification and idempotency are tested |

The function sources use environment variables for server credentials. Do not commit `SUPABASE_SERVICE_ROLE_KEY`, provider secrets, or OpenAI API keys. A source sync does not itself deploy or alter the live functions. Review diffs and run function tests before deploying future changes.
