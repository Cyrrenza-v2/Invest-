type ToolInput = Record<string, unknown>;
type WebMCPContext = {
  role: 'user' | 'admin';
  userId: string | null;
  authenticated: boolean;
  trustedAdmin: boolean;
  aal2: boolean;
};
type EdgeCall = <T>(fn: string, endpoint: string, method?: 'GET' | 'POST', body?: Record<string, unknown>, query?: string, signal?: AbortSignal) => Promise<T>;
type ToolDefinition = {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations: { readOnlyHint: true; untrustedContentHint: boolean };
  execute: (input: ToolInput, options: { signal?: AbortSignal }) => Promise<unknown>;
};
type ModelContext = {
  registerTool: (tool: ToolDefinition, options?: { signal?: AbortSignal }) => Promise<unknown> | unknown;
};
let activeController: AbortController | null = null;
let activeKey = '';

function modelContext(): ModelContext | null {
  const doc = document as Document & { modelContext?: ModelContext };
  const nav = navigator as Navigator & { modelContext?: ModelContext };
  const candidate = doc.modelContext ?? nav.modelContext ?? null;
  return candidate && typeof candidate.registerTool === 'function' ? candidate : null;
}

function boundedLimit(value: unknown, fallback = 20, maximum = 50): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(n) || n < 1) return fallback;
  return Math.min(n, maximum);
}

function optionalStatus(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || value.length > 40 || !/^[a-z_]+$/.test(value)) {
    throw new Error('Status must be a short lowercase status value.');
  }
  return value;
}

function requireSession(ctx: WebMCPContext, role: 'user' | 'admin') {
  if (!ctx.authenticated || !ctx.userId) throw new Error('Sign in again to use Invest Broker tools.');
  if (ctx.role !== role) throw new Error('This tool is not available in the current workspace.');
  if (role === 'admin' && (!ctx.trustedAdmin || !ctx.aal2)) {
    throw new Error('CEO authorization and verified MFA (AAL2) are required.');
  }
}

function limitSchema() {
  return {
    type: 'object',
    properties: {
      limit: { type: 'integer', minimum: 1, maximum: 50, description: 'Maximum number of records to return (1–50).' },
    },
    additionalProperties: false,
  };
}

export async function syncInvestBrokerWebMCP(
  getContext: () => WebMCPContext,
  edge: EdgeCall,
): Promise<void> {
  const ctx = getContext();
  const context = modelContext();
  const permitted = ctx.authenticated && !!ctx.userId &&
    (ctx.role === 'user' || (ctx.role === 'admin' && ctx.trustedAdmin && ctx.aal2));
  const nextKey = permitted ? `${ctx.role}:${ctx.userId}:${ctx.aal2}` : '';

  if (!context || !permitted) {
    activeController?.abort();
    activeController = null;
    activeKey = '';
    return;
  }
  if (activeKey === nextKey && activeController && !activeController.signal.aborted) return;

  activeController?.abort();
  const controller = new AbortController();
  activeController = controller;
  activeKey = nextKey;

  const customerTools: ToolDefinition[] = [
    {
      name: 'get_my_account_status',
      title: 'Get my account status',
      description: 'Read the signed-in customer’s own approval, account, and KYC status.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: true, untrustedContentHint: false },
      async execute(_input, { signal }) {
        if (signal?.aborted) throw new Error('Request cancelled.');
        requireSession(getContext(), 'user');
        const p = await edge<Record<string, unknown>>('user-api', 'profile', 'GET', undefined, undefined, signal);
        if (signal?.aborted) throw new Error('Request cancelled.');
        return {
          approval_status: p?.approval_status ?? null,
          account_status: p?.account_status ?? null,
          kyc_status: p?.kyc_status ?? null,
          updated_at: p?.updated_at ?? null,
        };
      },
    },
    {
      name: 'list_my_investments',
      title: 'List my investments',
      description: 'List investment records belonging only to the signed-in customer, with optional status filtering.',
      inputSchema: {
        type: 'object',
        properties: {
          status: { type: 'string', maxLength: 40, description: 'Optional lowercase investment status filter.' },
          limit: { type: 'integer', minimum: 1, maximum: 50, description: 'Maximum records to return (1–50).' },
        },
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true, untrustedContentHint: false },
      async execute(input, { signal }) {
        requireSession(getContext(), 'user');
        const filter = optionalStatus(input.status);
        const rows = await edge<Record<string, unknown>[]>('user-api', 'investments', 'GET', undefined, undefined, signal);
        if (signal?.aborted) throw new Error('Request cancelled.');
        return (Array.isArray(rows) ? rows : [])
          .filter(row => !filter || row.status === filter)
          .slice(0, boundedLimit(input.limit))
          .map(row => ({
            investment_code: row.investment_code ?? null,
            plan_id: row.plan_id ?? null,
            principal: row.principal ?? null,
            currency: row.currency ?? null,
            status: row.status ?? null,
            started_at: row.started_at ?? null,
            maturity_at: row.maturity_at ?? null,
            created_at: row.created_at ?? null,
          }));
      },
    },
    {
      name: 'list_my_transactions',
      title: 'List my transactions',
      description: 'List transaction ledger records for the signed-in customer, optionally filtered by transaction category.',
      inputSchema: {
        type: 'object',
        properties: {
          category: { type: 'string', enum: ['deposit', 'withdrawal', 'investment', 'return', 'adjustment'], description: 'Optional transaction category filter.' },
          limit: { type: 'integer', minimum: 1, maximum: 50, description: 'Maximum records to return (1–50).' },
        },
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      async execute(input, { signal }) {
        requireSession(getContext(), 'user');
        const category = input.category;
        if (category !== undefined && !['deposit', 'withdrawal', 'investment', 'return', 'adjustment'].includes(String(category))) {
          throw new Error('Choose a supported transaction category.');
        }
        const rows = await edge<Record<string, unknown>[]>('user-api', 'transactions', 'GET', undefined, undefined, signal);
        if (signal?.aborted) throw new Error('Request cancelled.');
        return (Array.isArray(rows) ? rows : [])
          .filter(row => !category || row.entry_type === category)
          .slice(0, boundedLimit(input.limit))
          .map(row => ({
            entry_type: row.entry_type ?? null,
            amount: row.amount ?? null,
            currency: row.currency ?? null,
            status: row.status ?? null,
            reference: row.reference ?? null,
            description: typeof row.description === 'string' ? row.description.slice(0, 240) : null,
            created_at: row.created_at ?? null,
            posted_at: row.posted_at ?? null,
          }));
      },
    },
  ];

  const adminTools: ToolDefinition[] = [
    {
      name: 'get_admin_operational_summary',
      title: 'Get admin operational summary',
      description: 'Read aggregate operational counts through the CEO-protected admin API.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: true, untrustedContentHint: false },
      async execute(_input, { signal }) {
        requireSession(getContext(), 'admin');
        const summary = await edge<Record<string, unknown>>('admin-api', 'dashboard', 'GET', undefined, undefined, signal);
        if (signal?.aborted) throw new Error('Request cancelled.');
        return summary;
      },
    },
    {
      name: 'list_admin_financial_records',
      title: 'List admin deposit or withdrawal records',
      description: 'Read a bounded list of deposit or withdrawal records after CEO authorization and MFA verification.',
      inputSchema: {
        type: 'object',
        properties: {
          category: { type: 'string', enum: ['deposits', 'withdrawals'], description: 'Financial record category to read.' },
          status: { type: 'string', maxLength: 40, description: 'Optional lowercase status filter.' },
          limit: { type: 'integer', minimum: 1, maximum: 50, description: 'Maximum records to return (1–50).' },
        },
        required: ['category'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      async execute(input, { signal }) {
        requireSession(getContext(), 'admin');
        if (input.category !== 'deposits' && input.category !== 'withdrawals') {
          throw new Error('Choose deposits or withdrawals.');
        }
        const filter = optionalStatus(input.status);
        const rows = await edge<Record<string, unknown>[]>('admin-api', input.category, 'GET', undefined, undefined, signal);
        if (signal?.aborted) throw new Error('Request cancelled.');
        return (Array.isArray(rows) ? rows : [])
          .filter(row => !filter || row.status === filter)
          .slice(0, boundedLimit(input.limit))
          .map(row => ({
            record_code: row.deposit_code ?? row.withdrawal_code ?? null,
            user_id: row.user_id ?? null,
            amount: row.amount ?? null,
            currency: row.currency ?? null,
            status: row.status ?? null,
            provider: row.provider ?? null,
            created_at: row.created_at ?? null,
            reviewed_at: row.reviewed_at ?? null,
            completed_at: row.completed_at ?? null,
          }));
      },
    },
    {
      name: 'list_admin_audit_records',
      title: 'List admin audit records',
      description: 'Read a bounded, minimized view of recent audit records through the CEO-protected admin API.',
      inputSchema: limitSchema(),
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      async execute(input, { signal }) {
        requireSession(getContext(), 'admin');
        const rows = await edge<Record<string, unknown>[]>('admin-api', 'audit-logs', 'GET', undefined, `limit=${boundedLimit(input.limit)}`, signal);
        if (signal?.aborted) throw new Error('Request cancelled.');
        return (Array.isArray(rows) ? rows : []).slice(0, boundedLimit(input.limit)).map(row => ({
          action: row.action ?? null,
          actor_role: row.actor_role ?? null,
          entity_type: row.entity_type ?? null,
          entity_id: row.entity_id ?? null,
          created_at: row.created_at ?? null,
        }));
      },
    },
  ];

  const tools = ctx.role === 'admin' ? adminTools : customerTools;
  try {
    for (const tool of tools) {
      if (controller.signal.aborted) return;
      await context.registerTool(tool, { signal: controller.signal });
    }
  } catch (error) {
    if (!controller.signal.aborted) {
      activeController?.abort();
      activeController = null;
      activeKey = '';
      console.warn('Invest Broker WebMCP registration skipped or incomplete.', error);
    }
  }
}

export function clearInvestBrokerWebMCP(): void {
  activeController?.abort();
  activeController = null;
  activeKey = '';
}
