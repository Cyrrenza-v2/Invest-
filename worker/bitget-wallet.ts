/**
 * Bitget Wallet integration safety boundary.
 *
 * This module intentionally does not sign, broadcast, or execute transactions.
 * Provider-specific API calls must be added only after their request/response
 * contracts are verified against the upstream skill's domain documentation.
 */
export type BitgetMode = "disabled" | "read-only" | "test";

export type TransactionIntent = {
  chain: string;
  fromAddress: string;
  toAddress: string;
  amount: string;
  asset: string;
  quoteId?: string;
  idempotencyKey: string;
  userConfirmed: boolean;
};

export type IntegrationConfig = {
  mode?: string;
  allowSigning?: string;
};

const SUPPORTED_MODES = new Set<BitgetMode>(["disabled", "read-only", "test"]);

export function getBitgetMode(config: IntegrationConfig): BitgetMode {
  const value = config.mode ?? "disabled";
  return SUPPORTED_MODES.has(value as BitgetMode) ? (value as BitgetMode) : "disabled";
}

export function validateTransactionIntent(value: unknown): value is TransactionIntent {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<TransactionIntent>;
  return (
    typeof item.chain === "string" && /^[a-z0-9-]{2,24}$/i.test(item.chain) &&
    typeof item.fromAddress === "string" && item.fromAddress.length >= 8 && item.fromAddress.length <= 128 &&
    typeof item.toAddress === "string" && item.toAddress.length >= 8 && item.toAddress.length <= 128 &&
    typeof item.amount === "string" && /^(?:0|[1-9]\d*)(?:\.\d{1,18})?$/.test(item.amount) && Number(item.amount) > 0 &&
    typeof item.asset === "string" && /^[A-Za-z0-9._-]{1,24}$/.test(item.asset) &&
    typeof item.idempotencyKey === "string" && /^[A-Za-z0-9._:-]{8,128}$/.test(item.idempotencyKey) &&
    (item.quoteId === undefined || (typeof item.quoteId === "string" && item.quoteId.length <= 256)) &&
    item.userConfirmed === true
  );
}

/**
 * Signing stays disabled even if an environment variable is accidentally set.
 * Enablement requires a separately reviewed signer implementation and tests.
 */
export function maySignOrBroadcast(_config: IntegrationConfig, _intent: unknown): false {
  return false;
}

export function isLiveExecutionEnabled(_config: IntegrationConfig): false {
  return false;
}
