type SupabaseUser = {
  id: string;
  email?: string;
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
  factors?: MfaFactor[];
};

type AuthSession = {
  access_token: string;
  refresh_token: string;
  expires_at?: number;
  user: SupabaseUser;
};

const env = import.meta.env as Record<string, string | undefined>;
const SUPABASE_URL = (env.VITE_SUPABASE_URL ?? 'https://rjgzvpkyccfpnpzlbcuc.supabase.co').replace(/\/$/, '');
const SUPABASE_ANON_KEY = env.VITE_SUPABASE_ANON_KEY ?? 'sb_publishable_WRqEfkebSkqEBYhiCSAXRA_Z_jovR3l';
const SESSION_KEY = 'invest-broker-supabase-session-v1';

export type Profile = { id: string; user_code?: string; full_name: string | null; phone?: string | null; kyc_status: string; account_status: string; approval_status: string; created_at?: string };
export type Wallet = { id: string; wallet_code?: string; user_id: string; currency: string; status: string };
export type Row = Record<string, unknown>;

export class SupabaseError extends Error {
  constructor(message: string, public status?: number) { super(message); this.name = 'SupabaseError'; }
}

const getSession = (): AuthSession | null => {
  try { const raw = localStorage.getItem(SESSION_KEY); return raw ? JSON.parse(raw) as AuthSession : null; } catch { return null; }
};
const saveSession = (session: AuthSession | null) => {
  if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session)); else localStorage.removeItem(SESSION_KEY);
};
const requireConfig = () => {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) throw new SupabaseError('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in the deployment environment.');
};

async function request<T>(path: string, init: RequestInit = {}, auth = true): Promise<T> {
  requireConfig();
  const session = getSession();
  const headers = new Headers(init.headers);
  headers.set('apikey', SUPABASE_ANON_KEY);
  headers.set('Accept', 'application/json');
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  headers.set('Authorization', `Bearer ${auth && session?.access_token ? session.access_token : SUPABASE_ANON_KEY}`);
  const response = await fetch(`${SUPABASE_URL}${path}`, { ...init, headers });
  const raw = await response.text();
  let data: unknown;
  try { data = raw ? JSON.parse(raw) : null; } catch { data = raw; }
  if (!response.ok) {
    const payload = typeof data === 'object' && data !== null ? data as Record<string, unknown> : null;
    const detail = payload ? payload.message ?? payload.msg ?? payload.error_description ?? payload.error : typeof data === 'string' && data.trim() ? data.trim() : null;
    const message = detail !== null && detail !== undefined ? `${path}: ${String(detail)}` : `${path}: Supabase request failed (${response.status})`;
    throw new SupabaseError(message, response.status);
  }
  return data as T;
}

export type MfaFactor = { id: string; factor_type: string; status: string; friendly_name?: string | null };
type MfaChallenge = { id?: string; challenge_id?: string; expires_at?: string };

export const supabase = {
  configured: Boolean(SUPABASE_URL && SUPABASE_ANON_KEY),
  session: getSession,
  async signIn(email: string, password: string): Promise<AuthSession> {
    const session = await request<AuthSession>('/auth/v1/token?grant_type=password', { method: 'POST', body: JSON.stringify({ email, password }) }, false);
    saveSession(session);
    return session;
  },
  async listMfaFactors(): Promise<MfaFactor[]> {
    // Supabase Auth returns enrolled MFA factors on the authenticated /user response.
    // /auth/v1/factors is not a supported listing route, and auth/factors is not a PostgREST table.
    const user = await request<SupabaseUser>('/auth/v1/user', { method: 'GET' });
    return Array.isArray(user.factors) ? user.factors : [];
  },
  async challengeMfa(factorId: string): Promise<MfaChallenge> {
    return request<MfaChallenge>(`/auth/v1/factors/${encodeURIComponent(factorId)}/challenge`, { method: 'POST', body: JSON.stringify({}) });
  },
  async verifyMfa(factorId: string, challengeId: string, code: string): Promise<AuthSession> {
    const session = await request<AuthSession>(`/auth/v1/factors/${encodeURIComponent(factorId)}/verify`, { method: 'POST', body: JSON.stringify({ challenge_id: challengeId, code }) });
    if (!session?.access_token || !session?.refresh_token || !session?.user) throw new SupabaseError('MFA verification did not return a valid authenticated session.');
    saveSession(session);
    return session;
  },
  async signUp(email: string, password: string, fullName: string): Promise<{ user: SupabaseUser | null; session: AuthSession | null }> {
    const result = await request<{ user: SupabaseUser | null; session?: AuthSession | null }>('/auth/v1/signup', { method: 'POST', body: JSON.stringify({ email, password, data: { full_name: fullName } }) }, false);
    if (result.session) saveSession(result.session);
    return { user: result.user ?? null, session: result.session ?? null };
  },
  async signOut(): Promise<void> {
    try { if (getSession()) await request('/auth/v1/logout', { method: 'POST' }); } finally { saveSession(null); }
  },
  async currentUser(): Promise<SupabaseUser | null> {
    const session = getSession();
    if (!session?.access_token) return null;
    try {
      return await request<SupabaseUser>('/auth/v1/user', { method: 'GET' });
    } catch (error) {
      if (error instanceof SupabaseError && (error.status === 401 || error.status === 403)) {
        if (session.refresh_token) {
          try {
            const refreshed = await this.refreshSession();
            if (refreshed?.access_token) return await request<SupabaseUser>('/auth/v1/user', { method: 'GET' });
          } catch {
            // A rejected refresh token means this saved session can no longer authenticate.
          }
        }
        // Never treat cached user details as proof of a valid server-side session.
        saveSession(null);
        return null;
      }
      // Keep cached identity only for transient network/server errors, not auth failures.
      return session.user ?? null;
    }
  },
  async refreshSession(): Promise<AuthSession | null> {
    const current = getSession();
    if (!current?.refresh_token) return null;
    const refreshed = await request<AuthSession>('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: JSON.stringify({ refresh_token: current.refresh_token }) }, false);
    saveSession(refreshed);
    return refreshed;
  },
  async select<T extends Row = Row>(table: string, query = 'select=*'): Promise<T[]> { return request<T[]>(`/rest/v1/${encodeURIComponent(table)}?${query}`); },
  async insert<T extends Row = Row>(table: string, body: Row | Row[], prefer = 'return=representation'): Promise<T[]> {
    return request<T[]>(`/rest/v1/${encodeURIComponent(table)}`, { method: 'POST', headers: { Prefer: prefer }, body: JSON.stringify(body) });
  },
  async update<T extends Row = Row>(table: string, query: string, body: Row): Promise<T[]> {
    return request<T[]>(`/rest/v1/${encodeURIComponent(table)}?${query}`, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(body) });
  },
  async edge<T = unknown>(functionName: string, route: string, options: { method?: 'GET' | 'POST'; body?: Row; query?: string; signal?: AbortSignal } = {}): Promise<T> {
    if (!getSession()?.access_token) throw new SupabaseError('Sign in again to continue. No authenticated session is available.');
    const method = options.method ?? 'GET'; const suffix = options.query ? `?${options.query}` : '';
    return request<T>(`/functions/v1/${encodeURIComponent(functionName)}/${encodeURIComponent(route)}${suffix}`, { method, signal: options.signal, ...(method === 'POST' ? { body: JSON.stringify(options.body ?? {}) } : {}) });
  },
  async invoke<T = unknown>(functionName: string, body: Row): Promise<T> {
    if (!getSession()?.access_token) throw new SupabaseError('Sign in again to continue. No authenticated session is available.');
    return request<T>(`/functions/v1/${encodeURIComponent(functionName)}`, { method: 'POST', body: JSON.stringify(body) });
  },
};
export const isAdmin = (user: SupabaseUser | null): boolean => user?.app_metadata?.role === 'admin';
export type { SupabaseUser, AuthSession };
