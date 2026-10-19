Invest-broker payment integrations — test-only status

Updated: 2026-10-12

## Intended providers

- PayCanvas — retained as a separate intended hosted-payment gateway. Its API contract, authentication, webhook signature rules, merchant eligibility, and sandbox access are not yet verified. Do not invent endpoint paths or credentials.
- PayU — retained as a separate intended hosted-payment gateway. PayU Builder MCP documentation identifies hosted checkout and server-side verification/webhook patterns. The retrieved material is from PayU India documentation; this does not establish that the merchant account or those exact endpoints are available for this Nigeria-based project. Confirm the user's merchant region, product, sandbox access, and API version before writing a live adapter.
- Direct crypto wallet deposits — retained as a separate flow. Supported assets and networks must be allow-listed only after a network/indexer and custody/receiving-address design are selected. Do not claim all assets are supported until an explicit provider/network catalog has been verified.

## Implemented scaffold

- public.payment_provider_registry tracks provider readiness and separate checkout/wallet-credit gates.
- public.payment_intents stores idempotency keys, provider references/events, crypto asset/network/transaction hash, confirmation counts, and status.
- supabase/functions/payment-api/index.ts authenticates customer JWTs, checks the account approval/active gate, scopes intent history to the signed-in user, and records test intents.
- src/main.jsx exposes separate PayCanvas, PayU, and crypto-wallet test-intent choices and a test history.

## Hard safety gates

- All provider rows begin unverified, test_mode_only = true, checkout_enabled = false, wallet_credit_enabled = false.
- Creating an intent does not contact a provider, issue a crypto receiving address, verify an on-chain transfer, or credit a wallet.
- No provider secret belongs in the frontend, GitHub, or this document. Keep credentials in Supabase Edge Function secrets after the exact API contract is confirmed.
- Browser redirects and screenshots are not payment proof.
- For PayU: verify server-to-server webhook authenticity/hash, compare merchant reference, amount, currency and final status, and reconcile via the provider's verification API before crediting.
- For PayCanvas: implement only after its own official API and webhook signature contract is supplied/verified.
- For crypto: independently verify the chain/network, destination address, asset contract/mint, amount, confirmation/finality threshold, and transaction uniqueness; never trust a user-submitted hash alone.
- Wallet credits must be a single database transaction that locks/claims the payment intent and writes an idempotent ledger transaction. This is not implemented in the current scaffold.
- Admin approvals, refunds, chargebacks, AML/KYC, sanctions checks, custody controls, and production authorization are outside this scaffold and must be designed/tested before launch.

## Provider documentation consulted

- PayU Hosted Checkout: https://docs.payu.in/docs/prebuilt-checkout-page-integration
- PayU Partner Hosted Checkout: https://docs.payu.in/docs/partner-payments-hosted-checkout-integration
- PayU Partner Webhook reference: https://docs.payu.in/reference/partner-webhook

PayU documentation specifically recommends server-to-server webhook verification, response hash validation, and reconciliation using a verification API rather than relying on browser redirects. Confirm product/region-specific docs before implementation.

## Tool boundaries

- GitHub stores the application code and triggers CI.
- Supabase hosts the database and authenticated Edge Function.
- PayU Builder MCP provides official integration catalog/documentation/snippets; it does not itself create or link a merchant account.
- No dedicated PayCanvas connector or Global Payments & Crypto payment connector was available in the connected tools during this pass. CoinGecko is available for crypto market data, not for receiving or verifying customer payments.

## Verification checklist

- [x] GitHub Actions build/test job passed for the latest payment UI commit.
- [x] Supabase migration applied and payment tables visible.
- [x] payment-api Edge Function active with JWT verification.
- [x] Provider rows start unverified and disabled.
- [ ] Provider sandbox credentials and merchant-region support verified.
- [ ] Provider-specific checkout adapters and signed webhook handlers implemented.
- [ ] Crypto address issuance/network indexer and confirmation policy implemented.
- [ ] Atomic, idempotent ledger crediting implemented and tested.
- [ ] End-to-end sandbox tests, webhook replay tests, duplicate-payment tests, and reconciliation tests passed.
- [ ] Production enablement explicitly approved; do not enable before all above checks pass.
