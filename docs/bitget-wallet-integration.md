# Bitget Wallet integration (safe foundation)

Repository: https://github.com/bitget-wallet-ai-lab/bitget-wallet-skill

## Scope of this change

This change adds a typed safety boundary and unit tests only. It does **not** clone or vendor the upstream skill, call the Bitget API, create wallets, sign transactions, broadcast swaps, or credit customer balances. Those actions must not be represented as integrated until provider-specific request/response contracts and an end-to-end test environment are available.

## Safe rollout

1. Keep the integration disabled by default.
2. Start with read-only market data and token-security checks only after the provider endpoints and response schemas have been verified from the upstream \`docs/market-data.md\`.
3. Before adding quote/order support, review \`docs/swap.md\` and the provider's confirmation flow. A quote is not an order and an order is not settlement.
4. Do not enable private-key or mnemonic handling in the browser. Do not commit wallet secrets or provider credentials.
5. Every signing operation must present chain, destination, asset, amount, and transaction data and wait for explicit user confirmation.
6. A customer balance may only be credited after independently verified chain/provider settlement, with a unique idempotency key and an auditable ledger entry. Never treat a quote, unsigned transaction, or pending order as a deposit.
7. Keep customer ledger and company treasury separate. The adapter does not bypass existing ledger authorization.

## Configuration

No secrets or provider credentials are required for the safety-boundary tests. The mode parser recognizes \`disabled\`, \`read-only\`, and \`test\`; unknown values fail closed to \`disabled\`. Live execution and signing remain hard-disabled in this implementation.

## Tests

Run:

\`\`\`sh
npx vitest run worker/bitget-wallet.test.ts
npm run build
npm run test:worker
\`\`\`

A passing unit suite verifies validation and fail-closed behavior only. It is not a provider API smoke test. A real read-only smoke test requires an approved provider API request and network access in CI or a controlled environment. A transaction smoke test must use a provider-supported test environment and must never move real funds.
