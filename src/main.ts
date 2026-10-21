import { isAdmin, supabase, type Profile, type Row, type SupabaseUser } from './supabase';
import { clearInvestBrokerWebMCP, syncInvestBrokerWebMCP } from './webmcp';

type Role = 'user' | 'admin';
type RecordRow = Row & { id?: string; user_id?: string; currency?: string; status?: string; created_at?: string; amount?: number; debit_amount?: number; credit_amount?: number; description?: string; entry_type?: string; principal?: number; investment_code?: string; deposit_code?: string; withdrawal_code?: string; name?: string; full_name?: string; user_code?: string; approval_status?: string; account_status?: string; kyc_status?: string };
type AppData = { user: SupabaseUser | null; profile: Profile | null; users: Profile[]; plans: RecordRow[]; wallets: RecordRow[]; adminWallets: RecordRow[]; adminPlans: RecordRow[]; returns: RecordRow[]; investments: RecordRow[]; transactions: RecordRow[]; deposits: RecordRow[]; withdrawals: RecordRow[]; treasury: RecordRow[]; compliance: RecordRow[]; audits: RecordRow[]; summary: Row; aiAnswer: string; aiModel: string; error: string; notice: string };
const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('App root not found');
const host = location.hostname.toLowerCase();
const isAdminHost = host === 'admin-invest-broker.vercel.app' || host === 'admin-invest-broker.pages.dev' || host.startsWith('admin-invest-broker-') || host === 'invest-broker-admin.pages.dev';
const ROLE: Role = isAdminHost || import.meta.env.VITE_APP_ROLE === 'admin' ? 'admin' : 'user';
const d: AppData = { user: null, profile: null, users: [], plans: [], wallets: [], adminWallets: [], adminPlans: [], returns: [], investments: [], transactions: [], deposits: [], withdrawals: [], treasury: [], compliance: [], audits: [], summary: {}, aiAnswer: '', aiModel: '', error: '', notice: '' };
let pendingMfa: { factorId: string; challengeId: string } | null = null;
let sequence = 0;
const e = (v: unknown): string => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] || c));
const date = (v: unknown) => v ? new Date(String(v)).toLocaleString() : '—';
const money = (v: unknown, c = 'USD') => Number.isFinite(Number(v)) ? new Intl.NumberFormat('en-US', { style: 'currency', currency: c, maximumFractionDigits: 2 }).format(Number(v)) : '—';
const status = (v: unknown) => { const s = String(v || 'unknown'); const t = ['approved','active','verified','posted','completed','confirmed'].includes(s) ? 'good' : ['rejected','suspended','failed','frozen'].includes(s) ? 'bad' : 'pending'; return '<span class="tag tag-' + t + '">' + e(s.replace(/_/g, ' ')) + '</span>'; };
const path = () => location.hash.replace(/^#/, '') || '/welcome';
const go = (p: string) => { location.hash = p; };
const err = (x: unknown) => x instanceof Error ? x.message : 'Unexpected error';
async function edge<T>(fn: string, endpoint: string, method: 'GET'|'POST' = 'GET', body?: Row, query?: string, signal?: AbortSignal): Promise<T> {
  const r = await supabase.edge<{data:T}|T>(fn, endpoint, { method, body, query, signal });
  return r && typeof r === 'object' && 'data' in r ? (r as {data:T}).data : r as T;
}
function table(head: string[], rows: string[][], empty = 'No records found.') {
  return '<div class="table-wrap"><table class="data-table"><thead><tr>' + head.map(x => '<th>' + e(x) + '</th>').join('') + '</tr></thead><tbody>' +
    (rows.length ? rows.map(r => '<tr>' + r.map(c => '<td>' + c + '</td>').join('') + '</tr>').join('') : '<tr><td class="empty-cell" colspan="' + head.length + '">' + e(empty) + '</td></tr>') + '</tbody></table></div>';
}
function panel(title: string, body: string, sub = 'Invest Broker') {
  return '<section class="page-section-card"><div class="section-heading"><div><p class="eyebrow">' + e(sub) + '</p><h3>' + e(title) + '</h3></div><button class="ghost small" data-action="refresh">Refresh</button></div>' + body + '</section>';
}
function metrics(rows: Array<[string,string,string]>) {
  return '<section class="metrics-grid">' + rows.map(r => '<article class="metric-card"><p>' + e(r[0]) + '</p><h3>' + e(r[1]) + '</h3><span>' + e(r[2]) + '</span></article>').join('') + '</section>';
}
const userLinks = [['/user/dashboard','Home'],['/user/investments','Investments'],['/user/wallet','Wallet'],['/user/deposit','Deposits'],['/user/withdraw','Withdrawals'],['/user/transactions','Transactions'],['/user/notifications','Notifications'],['/user/kyc','KYC'],['/user/profile','Profile'],['/user/security','Security'],['/user/support','Support']];
const adminLinks = [['/admin/dashboard','Dashboard'],['/admin/users','Customers'],['/admin/approvals','Approvals'],['/admin/wallets','Wallets'],['/admin/investments','Investments'],['/admin/investment-plans','Investment plans'],['/admin/profit-management','Profit management'],['/admin/deposits','Deposits'],['/admin/withdrawals','Withdrawals'],['/admin/treasury','Treasury'],['/admin/compliance','Compliance'],['/admin/fraud-investigations','Fraud investigations'],['/admin/ai-assistant','AI assistant'],['/admin/reports','Reports'],['/admin/audit-logs','Audit logs'],['/admin/settings','Settings']];
function title(p: string) {
  const names: Record<string,string> = {'/user/dashboard':'Home · account overview','/user/investments':'Your investment status','/user/wallet':'Wallet · transactions and payment methods','/user/deposit':'Deposit history','/user/withdraw':'Withdrawal history','/user/transactions':'Transaction history','/user/notifications':'Notifications','/user/kyc':'Identity and KYC','/user/profile':'Your profile and verification','/user/security':'Security and sessions','/user/support':'Customer support','/admin/dashboard':'Operations dashboard','/admin/users':'Customer management','/admin/approvals':'Account approval queue','/admin/wallets':'Wallet register','/admin/investments':'Investment oversight','/admin/investment-plans':'Investment plan management','/admin/profit-management':'Profit and returns ledger','/admin/deposits':'Deposit records','/admin/withdrawals':'Withdrawal records','/admin/treasury':'Treasury accounts','/admin/compliance':'Compliance cases','/admin/fraud-investigations':'Fraud investigations · evidence review','/admin/ai-assistant':'Admin AI assistant','/admin/reports':'Operations reports','/admin/settings':'Platform settings','/admin/audit-logs':'Audit trail'};
  return names[p] || 'Invest Broker';
}
function shell(body: string, active: string) {
  const links = ROLE === 'user' ? userLinks : adminLinks;
  return '<div class="app-layout"><aside class="sidebar"><a class="brand" href="#/welcome"><span class="brand-mark">IB</span><span><strong>Invest Broker</strong><small>' + (ROLE === 'user' ? 'Customer workspace' : 'Admin CEO workspace') + '</small></span></a><nav class="sidebar-nav">' +
    links.map(l => '<a class="menu-link ' + (active === l[0] ? 'is-active' : '') + '" href="#' + l[0] + '">' + l[1] + '</a>').join('') +
    '</nav><div class="sidebar-foot"><span class="live-dot"></span> Authenticated workspace</div></aside><main class="main-panel"><header class="topbar"><div><p class="eyebrow">' + (ROLE === 'user' ? 'Customer portal' : 'Restricted operations') + '</p><h1>' + e(title(active)) + '</h1></div><div class="top-actions"><span class="account-pill">' + e(d.profile?.full_name || d.user?.email || 'Account') + '</span><button class="ghost" data-action="refresh">Refresh</button><button class="ghost" data-action="logout">Sign out</button></div></header>' +
    (d.error ? '<div class="notice notice-error">' + e(d.error) + '</div>' : '') + (d.notice ? '<div class="notice notice-info">' + e(d.notice) + '</div>' : '') + body +
    '<footer class="app-footer">Account records are returned by Supabase-authenticated APIs. No demo financial balances are substituted.</footer></main></div>';
}
function welcome() {
  return '<main class="welcome-page"><header class="welcome-head"><a class="brand" href="#/welcome"><span class="brand-mark">IB</span><span><strong>Invest Broker</strong><small>Secure investment workspace</small></span></a><span class="secure-label">Supabase-backed access</span></header><section class="welcome-hero"><div class="hero-copy"><p class="eyebrow">' + (ROLE === 'user' ? 'Your account, clearly presented' : 'Private operations console') + '</p><h1>' + (ROLE === 'user' ? 'A clearer view of your investment journey.' : 'Run operations with clear controls.') + '</h1><p>' + (ROLE === 'user' ? 'Sign in to see your account profile, USD wallet availability, investments, and ledger activity.' : 'Review customer applications, investments, deposits, withdrawals, treasury, compliance, and audit information.') + '</p><div class="hero-actions"><button class="primary" data-action="route" data-route="' + (ROLE === 'user' ? '/login/user' : '/login/admin') + '">Sign in</button>' + (ROLE === 'user' ? '<button class="ghost" data-action="route" data-route="/register/user">Create customer account</button>' : '') + '</div><p class="small-text muted">No simulated balances, payments, or approvals.</p></div><div class="hero-art"><div class="orbit orbit-one"></div><div class="orbit orbit-two"></div><div class="art-card"><span class="art-icon">IB</span><small>ACCOUNT SECURITY</small><strong>Authenticated access</strong><span class="art-line"></span><span class="art-line short"></span><div class="art-footer"><span>Supabase Auth</span><span class="live-dot"></span></div></div></div></section><section class="welcome-features"><article><span>01</span><h3>' + (ROLE === 'user' ? 'Your account data' : 'Customer oversight') + '</h3><p>Data is fetched after authentication and filtered by backend permissions.</p></article><article><span>02</span><h3>' + (ROLE === 'user' ? 'USD-only display' : 'Ledger-aware controls') + '</h3><p>' + (ROLE === 'user' ? 'NGN wallet records are never converted or presented as USD.' : 'Money movement remains server-authorized; this interface does not post ledger entries.') + '</p></article><article><span>03</span><h3>Clear status</h3><p>Pending access or backend errors are shown without inventing a success.</p></article></section></main>';
}
function authPage(mode: 'login'|'register') {
  return '<main class="auth-page"><a class="brand" href="#/welcome"><span class="brand-mark">IB</span><span><strong>Invest Broker</strong><small>' + (ROLE === 'user' ? 'Customer portal' : 'Admin CEO portal') + '</small></span></a><section class="auth-card"><p class="eyebrow">' + (ROLE === 'user' ? 'Customer access' : 'Restricted administrator access') + '</p><h1>' + (mode === 'login' ? 'Welcome back' : 'Create your account') + '</h1><p class="muted">' + (mode === 'login' ? 'Sign in using your Supabase account.' : 'New accounts remain pending administrator approval.') + '</p><form data-form="auth" data-mode="' + mode + '">' +
    (mode === 'register' ? '<label>Full name<input name="full_name" autocomplete="name" required maxlength="120" placeholder="Your full name"></label>' : '') +
    '<label>Email address<input name="email" type="email" autocomplete="email" required placeholder="you@example.com"></label><label>Password<input name="password" type="password" autocomplete="' + (mode === 'login' ? 'current-password' : 'new-password') + '" minlength="8" required placeholder="Password"></label><button class="primary full-width" type="submit">' + (mode === 'login' ? 'Sign in securely' : 'Create customer account') + '</button></form><p class="auth-switch">' +
    (mode === 'login' && ROLE === 'user' ? 'New here? <a href="#/register/user">Create an account</a>' : mode === 'register' ? '<a href="#/login/user">Already registered? Sign in</a>' : '<a href="#/welcome">Back to welcome</a>') +
    '</p><p class="small-text muted">Admin access comes from trusted server-side role metadata, never from a form selection.</p></section></main>';
}
function currentAssuranceLevel(): string | null {
  const token = supabase.session()?.access_token;
  if (!token) return null;
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const claims = JSON.parse(atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '='))) as { aal?: unknown };
    return typeof claims.aal === 'string' ? claims.aal : null;
  } catch { return null; }
}
async function showAdminMfaChallenge(): Promise<void> {
  const factors = await supabase.listMfaFactors();
  const factor = factors.find(x => x.status === 'verified' && x.factor_type === 'totp');
  if (!factor) throw new Error('Admin CEO access requires a verified authenticator factor. Contact the platform owner to enroll one securely.');
  const challenge = await supabase.challengeMfa(factor.id);
  const challengeId = challenge.id || challenge.challenge_id;
  if (!challengeId) throw new Error('Supabase did not return an MFA challenge. Please sign in again.');
  pendingMfa = { factorId: factor.id, challengeId };
  app!.innerHTML = adminMfaPage();
}
function adminMfaPage() {
  return '<main class="auth-page"><a class="brand" href="#/welcome"><span class="brand-mark">IB</span><span><strong>Invest Broker</strong><small>Admin CEO two-step verification</small></span></a><section class="auth-card"><p class="eyebrow">Second verification required</p><h1>Verify it’s you</h1><p class="muted">Enter the current 6-digit code from your enrolled authenticator app. The backend will not release the admin dashboard until this verification succeeds.</p><form data-form="mfa"><label>Authenticator code<input name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" minlength="6" maxlength="6" required placeholder="000000"></label><button class="primary full-width" type="submit">Verify and open admin dashboard</button></form><p class="auth-switch"><a href="#/login/admin" data-action="cancel-mfa">Cancel and sign in again</a></p><p class="small-text muted">Verification is checked by Supabase Auth and the protected admin API.</p></section></main>';
}
function pendingPage() {
  return '<section class="state-card"><div class="state-symbol">…</div><p class="eyebrow">Application status</p><h2>' + (d.profile?.approval_status === 'rejected' ? 'Application not approved' : 'Waiting for account approval') + '</h2><p>Account access requires approval and activation by an authorized administrator.</p><div class="status-row"><span>Approval</span>' + status(d.profile?.approval_status) + '</div><div class="status-row"><span>Account</span>' + status(d.profile?.account_status) + '</div><button class="ghost" data-action="refresh">Check status</button><button class="ghost" data-action="logout">Sign out</button></section>';
}
async function loadUser() {
  d.profile = await edge<Profile>('user-api','profile');
  if (d.profile.approval_status !== 'approved' || d.profile.account_status !== 'active') return;
  const values = await Promise.all([
    edge<RecordRow|null>('user-api','wallet').catch(() => null),
    edge<RecordRow[]>('user-api','investment-plans').catch(() => []),
    edge<RecordRow[]>('user-api','investments').catch(() => []),
    edge<RecordRow[]>('user-api','transactions').catch(() => []),
    edge<RecordRow[]>('user-api','deposits').catch(() => []),
    edge<RecordRow[]>('user-api','withdrawals').catch(() => []),
  ]);
  d.wallets = values[0] ? [values[0]] : []; d.plans = values[1] || []; d.investments = values[2] || []; d.transactions = values[3] || []; d.deposits = values[4] || []; d.withdrawals = values[5] || [];
}
async function loadAdmin() {
  const values = await Promise.all([
    edge<Row>('admin-api','dashboard'),
    edge<Profile[]>('admin-api','users','GET',undefined,'limit=200'),
    edge<RecordRow[]>('admin-api','investments','GET',undefined,'limit=200'),
    edge<RecordRow[]>('admin-api','deposits','GET',undefined,'limit=200'),
    edge<RecordRow[]>('admin-api','withdrawals','GET',undefined,'limit=200'),
    edge<RecordRow[]>('admin-api','treasury','GET',undefined,'limit=200'),
    edge<RecordRow[]>('admin-api','compliance','GET',undefined,'limit=200'),
    edge<RecordRow[]>('admin-api','audit-logs','GET',undefined,'limit=100'),
    edge<RecordRow[]>('admin-api','wallets','GET',undefined,'limit=300'),
    edge<RecordRow[]>('admin-api','investment-plans','GET',undefined,'limit=200'),
    edge<RecordRow[]>('admin-api','returns','GET',undefined,'limit=300'),
  ]);
  d.summary = values[0] || {}; d.users = values[1] || []; d.investments = values[2] || []; d.deposits = values[3] || []; d.withdrawals = values[4] || []; d.treasury = values[5] || []; d.compliance = values[6] || []; d.audits = values[7] || []; d.adminWallets = values[8] || []; d.adminPlans = values[9] || []; d.returns = values[10] || [];
}
function userContent(p: string): string {
  const usd = (x: RecordRow) => String(x.currency || 'USD') === 'USD';
  const posted = d.transactions.filter(x => usd(x) && String(x.status || '').toLowerCase() === 'posted');
  const wallet = d.wallets.find(x => x.currency === 'USD');
  const invStatus = (x: RecordRow) => String(x.status || 'pending').toLowerCase();
  const amountFor = (x: RecordRow) => money(x.amount ?? x.credit_amount ?? x.debit_amount ?? 0, String(x.currency || 'USD'));

  if (p === '/user/dashboard') {
    const invested = d.investments.reduce((sum,x) => sum + (Number(x.principal) || 0), 0);
    const earned = posted.filter(x => /profit|return|credit/i.test(String(x.entry_type || '') + ' ' + String(x.description || '')))
      .reduce((sum,x) => sum + (Number(x.credit_amount ?? x.amount) || 0), 0);
    const recent = d.transactions.filter(usd).slice(0,5);
    return '<section class="user-home-hero"><div><p class="eyebrow">Your Invest Broker account</p><h2>Welcome back, ' + e(d.profile?.full_name || 'Investor') + '</h2><p class="muted">A clear view of your account. Investment changes and profit records are managed by the Invest Broker team.</p></div><div class="wallet-banner"><div><p class="eyebrow">Available USD wallet</p><h2>' + e(wallet ? String(wallet.status || 'Provisioned') : 'Not provisioned') + '</h2><p>' + e(wallet ? 'Wallet status from your account record' : 'Your wallet balance is not available from the current API') + '</p></div><span class="wallet-currency">USD</span></div></section>' +
      metrics([['Investment records',String(d.investments.length),'Admin-managed records'],['Principal recorded',money(invested,'USD'),'From your investment records'],['Posted profit credits',money(earned,'USD'),'Posted USD ledger entries only'],['Account status',String(d.profile?.account_status || '—'),String(d.profile?.approval_status || 'Approval pending')]]) +
      '<div class="content-grid">' +
      panel('Investment overview','<p class="muted">Open Investment to track active, pending, completed, and lost records. You cannot create or edit investments from the customer app.</p><a class="primary inline-action" href="#/user/investments">View my investments</a>') +
      panel('Recent wallet activity',table(['Activity','Amount','Status','Date'],recent.map(x=>[e(x.entry_type || x.description || 'Transaction'),e(amountFor(x)),status(x.status),e(date(x.created_at))]),'No wallet activity recorded.')) +
      '</div><div class="notice notice-info">Only posted ledger entries count as credited profit. Estimates and pending entries are not treated as earned money.</div>';
  }

  if (p === '/user/investments') {
    const buckets = [
      ['Active',d.investments.filter(x=>['active','approved','running'].includes(invStatus(x)))],
      ['Pending',d.investments.filter(x=>['pending','submitted','under_review'].includes(invStatus(x)))],
      ['Completed',d.investments.filter(x=>['completed','matured','closed'].includes(invStatus(x)))],
      ['Lost',d.investments.filter(x=>['lost','loss','cancelled','failed'].includes(invStatus(x)))],
    ];
    return metrics(buckets.map(([label,items])=>[String(label),String((items as RecordRow[]).length),'Recorded investment status'] as [string,string,string])) +
      buckets.map(([label,items])=>panel(String(label)+' investments',table(['Reference','Principal','Plan','Status','Start / maturity'],(items as RecordRow[]).map(x=>[e(x.investment_code || x.id || '—'),e(money(x.principal,x.currency || 'USD')),e(x.name || x.plan_name || 'Investment plan'),status(x.status),e(date(x.maturity_at || x.created_at))]),'No '+String(label).toLowerCase()+' investments recorded.'))).join('') +
      '<div class="notice notice-info">Investment records and any profit/loss figures are maintained by the authorized admin. The customer app is read-only for investment management.</div>';
  }

  if (p === '/user/wallet') {
    const tx = d.transactions.filter(usd);
    const deposits = d.deposits.filter(usd);
    const withdrawals = d.withdrawals.filter(usd);
    const transactionRows = tx.map(x=>[e(x.entry_type || x.description || 'Ledger entry'),e(x.description || '—'),e(amountFor(x)),status(x.status),e(date(x.created_at))]);
    return '<section class="wallet-banner"><div><p class="eyebrow">Customer wallet</p><h2>USD wallet</h2><p>Deposits, withdrawals, profit credits, fees, and other recorded ledger activity are shown below when returned by the secure backend.</p><p class="small-text muted">' + e(wallet ? 'Wallet status: '+String(wallet.status || 'available') : 'No USD wallet record was returned by the API. No balance is estimated or converted.') + '</p></div><span class="wallet-currency">USD</span></section>' +
      '<section class="wallet-actions-grid"><article class="wallet-action-card"><span class="wallet-action-icon">↓</span><h3>Deposit</h3><p>Start or review a deposit request.</p><a class="primary inline-action" href="#/user/deposit">Open deposits</a></article><article class="wallet-action-card"><span class="wallet-action-icon">↑</span><h3>Withdraw</h3><p>Review withdrawal requests and statuses.</p><a class="primary inline-action" href="#/user/withdraw">Open withdrawals</a></article></section>' +
      '<section class="wallet-methods-grid"><article class="page-section-card"><p class="eyebrow">Payment methods</p><h3>Supported methods</h3><ul class="clean-list"><li>Bank transfer or card payments — only after provider setup is verified.</li><li>Bitcoin and other crypto assets — only for assets supported by a verified wallet/payment provider.</li><li>ATM / bank card management — display and card controls require a verified card provider.</li></ul><p class="small-text muted">These are planned payment options, not confirmation that a gateway is connected. No card number, PIN, or CVV is stored by this app.</p></article><article class="page-section-card"><p class="eyebrow">Wallet summary</p><h3>Activity counts</h3>' + metrics([['USD ledger entries',String(tx.length),'All returned statuses'],['Deposits',String(deposits.length),'USD deposit records'],['Withdrawals',String(withdrawals.length),'USD withdrawal records']]) + '</article></section>' +
      panel('Full USD transaction history',table(['Type','Description','Amount','Status','Date'],transactionRows,'No USD transactions returned by the backend.')) +
      panel('Deposit requests',table(['Reference','Amount','Status','Created'],deposits.map(x=>[e(x.deposit_code || x.id || '—'),e(amountFor(x)),status(x.status),e(date(x.created_at))]),'No USD deposit requests.')) +
      panel('Withdrawal requests',table(['Reference','Amount','Status','Created'],withdrawals.map(x=>[e(x.withdrawal_code || x.id || '—'),e(amountFor(x)),status(x.status),e(date(x.created_at))]),'No USD withdrawal requests.'));
  }

  if (p === '/user/deposit') return panel('Deposit requests',table(['Reference','Amount','Currency','Status','Created'],d.deposits.filter(usd).map(x=>[e(x.deposit_code || x.id || '—'),e(amountFor(x)),e(x.currency || 'USD'),status(x.status),e(date(x.created_at))]),'No USD deposit records.')) + '<div class="notice notice-info">A deposit request is not a payment confirmation. New deposits remain unavailable until a payment provider is verified and the server confirms settlement.</div><a class="ghost inline-action" href="#/user/wallet">Back to Wallet</a>';
  if (p === '/user/withdraw') return panel('Withdrawal requests',table(['Reference','Amount','Currency','Status','Created'],d.withdrawals.filter(usd).map(x=>[e(x.withdrawal_code || x.id || '—'),e(amountFor(x)),e(x.currency || 'USD'),status(x.status),e(date(x.created_at))]),'No USD withdrawal records.')) + '<div class="notice notice-info">Withdrawal release requires server-side balance checks, admin approval, and provider settlement. This view does not release funds.</div><a class="ghost inline-action" href="#/user/wallet">Back to Wallet</a>';
  if (p === '/user/profile') return panel('Personal information','<form data-form="profile" class="stack-form"><label>Full name<input name="full_name" required maxlength="120" value="' + e(d.profile?.full_name || '') + '" autocomplete="name"></label><label>Email address<input value="' + e(d.user?.email || '') + '" readonly aria-readonly="true"></label><label>User ID<input value="' + e(d.user?.id || d.profile?.id || '') + '" readonly aria-readonly="true" autocomplete="off"></label><p class="small-text muted">Your User ID is a support reference. Keep your password, session tokens, and verification codes private.</p><label>Customer code<input value="' + e(d.profile?.user_code || '') + '" readonly aria-readonly="true"></label><button class="primary" type="submit">Save profile changes</button></form>') +
      panel('Profile picture','<p class="muted">Profile picture upload will be enabled when a private storage bucket and upload policies are verified. No public upload destination is assumed.</p>') +
      panel('Identity verification', '<p>Current KYC status: ' + status(d.profile?.kyc_status) + '</p><a class="primary inline-action" href="#/user/kyc">Open KYC verification</a>') +
      panel('Account tools','<div class="profile-tool-links"><a href="#/user/security">Security & sessions</a><a href="#/user/notifications">Notifications</a><a href="#/user/support">Help & support</a><button class="ghost" data-action="logout">Sign out</button></div>');
  if (p === '/user/kyc') return metrics([['KYC status',String(d.profile?.kyc_status || '—'),'Current profile record'],['Account approval',String(d.profile?.approval_status || '—'),'Admin-reviewed access gate']]) + panel('Identity verification','<p>Current KYC status: ' + status(d.profile?.kyc_status) + '</p><p class="muted">Secure document upload is not enabled until private storage and access policies are verified. Do not upload identity documents through an unsecured form.</p><a class="ghost inline-action" href="#/user/profile">Back to Profile</a>');
  if (p === '/user/notifications') return panel('Notifications','<p class="muted">Account, deposit, withdrawal, KYC, profit-credit and security notifications will appear here when the user notification API is enabled.</p><a class="ghost inline-action" href="#/user/profile">Back to Profile</a>');
  if (p === '/user/security') return panel('Security & sessions','<ul class="clean-list"><li>Use a unique password and keep it private.</li><li>Sign out on shared devices.</li><li>Admin privileges are server-controlled and require verified MFA.</li></ul><a class="ghost inline-action" href="#/user/profile">Back to Profile</a>');
  if (p === '/user/transactions') return go('/user/wallet'), '';
  if (p === '/user/support') return panel('Help & support','<form data-form="support" class="stack-form"><label>Subject<input name="subject" required maxlength="200" placeholder="How can we help?"></label><label>Message<textarea name="body" required maxlength="10000" rows="5" placeholder="Describe your question"></textarea></label><button class="primary" type="submit">Send support message</button></form>','Secure message') + '<a class="ghost inline-action" href="#/user/profile">Back to Profile</a>';
  return userContent('/user/dashboard');
}
function productionSafetyGate(): string {
  return '<section class="notice notice-error" role="alert" aria-live="polite"><strong>PRODUCTION SAFETY GATE — FINANCIAL OPERATIONS NOT CLEARED</strong><p>Dashboard figures are calculated from the database records currently readable by this session. Empty tables mean no records have been loaded; they do not prove zero exposure, zero risk, or a reconciled financial position.</p><p><strong>Do not approve, release, settle, or move customer funds</strong> until server-side transaction workflows, ledger posting and reconciliation, and the payment/custody provider have been independently verified. Keep real-money operations disabled until those checks pass.</p></section>';
}
function adminContent(p: string): string {
  if (p === '/admin/fraud-investigations') {
    const sources: Array<{kind:string;route:string;rows:RecordRow[]}> = [
      {kind:'Investment',route:'/admin/investments',rows:d.investments},
      {kind:'Deposit',route:'/admin/deposits',rows:d.deposits},
      {kind:'Withdrawal',route:'/admin/withdrawals',rows:d.withdrawals},
    ];
    const evidence = sources.flatMap(source => source.rows.map(x => ({
      kind:source.kind, route:source.route, id:String(x.id || x.investment_code || x.deposit_code || x.withdrawal_code || '—'),
      user:String(x.user_id || '—'), status:String(x.status || 'unknown'),
      date:String(x.created_at || ''), description:String(x.description || x.entry_type || ''),
      reference:String(x.reference || x.transaction_hash || x.deposit_code || x.withdrawal_code || x.investment_code || x.id || '—')
    })));
    const reviewStates = new Set(['failed','rejected','blocked','flagged','chargeback','disputed','under_review','manual_review','suspicious']);
    const candidates = evidence.filter(x => reviewStates.has(x.status.toLowerCase().replace(/\s+/g,'_')));
    const rows = (candidates.length ? candidates : evidence).slice(0,200).map(x => [
      e(x.kind), '<a href="#' + x.route + '">' + e(x.id) + '</a>', e(x.user), e(x.reference),
      status(x.status), e(x.description || '—'), e(date(x.date))
    ]);
    return productionSafetyGate() +
      metrics([['Records available',String(evidence.length),'Read-only source records'],['Review candidates',String(candidates.length),'Status-based triage only'],['Compliance records',String(d.compliance.length),'Existing compliance API data']]) +
      panel('Fraud investigation evidence register',
        '<p class="muted">This initial module organizes records already loaded from the protected admin APIs. It does not create persistent investigation cases, independently verify blockchain transactions, or determine that fraud occurred.</p>' +
        table(['Source','Record ID','User ID','Reference / hash','Record status','Description','Created'],rows,'No investment, deposit, or withdrawal records are currently available to review.') +
        '<div class="notice notice-info"><strong>Evidence handling:</strong> preserve original transaction references and timestamps, document how evidence was obtained, and record findings separately from the financial ledger. Status-based candidates require human review; a failed or rejected transaction is not proof of fraud.</div>' +
        '<p class="small-text muted">Source links open the existing read-only investments, deposits, or withdrawals pages. This page does not expose new write actions or move/freeze funds.</p>');
  }

  if (p === '/admin/dashboard') return productionSafetyGate() + metrics([['Customer profiles',String(d.summary.users ?? d.users.length),'Readable records · not reconciliation'],['Pending approvals',String(d.users.filter(x => x.approval_status === 'pending').length),'Requires review'],['Investment records',String(d.investments.length),'Readable records · not exposure totals'],['Treasury accounts',String(d.treasury.length),'No balance inferred']]) + '<div class="content-grid">' + panel('Operations snapshot',table(['Metric','Count'],[['Active/matured investments',e(d.summary.activeOrMaturedInvestments ?? '—')],['Pending deposits',e(d.summary.pendingDeposits ?? d.deposits.filter(x => ['pending','processing'].includes(String(x.status))).length)],['Pending withdrawals',e(d.summary.pendingWithdrawals ?? d.withdrawals.filter(x => ['pending','under_review'].includes(String(x.status))).length)],['Open compliance cases',e(d.summary.openComplianceCases ?? '—')]])) + panel('Safety controls','<ul class="clean-list"><li>Customer approval is processed through the admin API.</li><li>Payment settlement and ledger posting stay server-authorized.</li><li>Admin data is protected by JWT role metadata and database policies.</li><li>No balances are calculated from unverified or cross-currency data.</li></ul>') + '</div>';
  if (p === '/admin/wallets') return panel('Customer wallet register',table(['Wallet','Customer ID','Currency','Status','Created'],d.adminWallets.map(x => [e(x.wallet_code || x.id),e(x.user_id || '—'),e(x.currency || '—'),status(x.status),e(date(x.created_at))]),'No wallet records returned.')) + '<div class="notice notice-info">USD and NGN wallets are shown as separate records. This register does not calculate balances or convert currencies.</div>';
  if (p === '/admin/investment-plans') return panel('Published investment plans',table(['Plan','Currency','Minimum','Maximum','Term','Return terms','Status'],d.adminPlans.map(x => [e(x.name),e(x.currency || '—'),e(money(x.minimum_amount,x.currency || 'USD')),e(x.maximum_amount == null ? 'No maximum' : money(x.maximum_amount,x.currency || 'USD')),e(String(x.duration_days || '—') + ' days'),e(String(x.return_rate ?? '—') + '% · ' + String(x.return_method || '—')),status(x.is_active ? 'active' : 'inactive')]),'No investment plans returned.')) + '<div class="notice notice-info">Plan editing is read-only until a server-authorized plan-management operation is available.</div>';
  if (p === '/admin/profit-management') return panel('Posted return ledger',table(['Entry type','User ID','Amount','Currency','Status','Reference','Posted'],d.returns.map(x => [e(x.entry_type || '—'),e(x.user_id || '—'),e(money(x.amount,x.currency || 'USD')),e(x.currency || '—'),status(x.status),e(x.reference || '—'),e(date(x.posted_at || x.created_at))]),'No return ledger entries returned.')) + '<div class="notice notice-info">Only posted ledger entries count as recorded returns. Projected plan returns are not profit credits. No profit can be created from this screen.</div>';
  if (p === '/admin/reports') return productionSafetyGate() + metrics([['Customers',String(d.summary.users ?? d.users.length),'Readable API records'],['Investments',String(d.investments.length),'Readable records · not exposure totals'],['Pending deposits',String(d.summary.pendingDeposits ?? d.deposits.filter(x => ['pending','processing'].includes(String(x.status))).length),'Operational queue · not reconciliation'],['Pending withdrawals',String(d.summary.pendingWithdrawals ?? d.withdrawals.filter(x => ['pending','under_review'].includes(String(x.status))).length),'Operational queue']]) + panel('Reporting scope','<ul class="clean-list"><li>Reports use records returned by the protected admin API.</li><li>Amounts are not aggregated across different currencies.</li><li>Financial reconciliation exports are not enabled in this UI.</li></ul>');
  if (p === '/admin/settings') return productionSafetyGate() + panel('Platform safety settings','<ul class="clean-list"><li>Customer and admin applications are separate deployments.</li><li>Admin API requires trusted role metadata, active account checks, and verified session assurance.</li><li>Money movement must remain server-authorized and audited.</li><li>Customer wallet display is USD-only; admin wallets preserve each original currency.</li><li>Payment providers and production financial mutations must be verified before enabling.</li></ul>') + '<div class="notice notice-info">Configuration changes are not available in the browser. Manage secrets only in the backend provider dashboard.</div>';
  if (p === '/admin/ai-assistant') return panel('Read-only operations assistant','<p class="muted">Ask for an operational summary or a recommendation. The assistant receives aggregate counts only and cannot move money or change account state.</p><form data-form="admin-ai" class="stack-form"><label>Your question<textarea name="question" rows="3" maxlength="1200" required placeholder="Summarize current operational risks"></textarea></label><button class="primary" type="submit">Ask Admin AI</button></form>' + (d.aiAnswer ? '<div class="ai-answer"><p class="eyebrow">Assistant response · ' + e(d.aiModel || 'read-only') + '</p><p>' + e(d.aiAnswer).replace(/\n/g,'<br>') + '</p></div>' : '') + '<div class="notice notice-info">Requires administrator authorization, verified MFA (AAL2), and the server-side OPENAI_API_KEY secret.</div>');
  if (p === '/admin/users') return panel('Customer accounts',table(['Customer','Code','KYC','Account','Approval','Created'],d.users.map(x => [e(x.full_name || 'Unnamed customer'),e(x.user_code || '—'),status(x.kyc_status),status(x.account_status),status(x.approval_status),e(date(x.created_at))]),'No customer profiles returned.'));
  if (p === '/admin/approvals') return panel('Pending applications',table(['Name','Customer code','Submitted','Action'],d.users.filter(x => x.approval_status === 'pending').map(x => [e(x.full_name || 'Unnamed customer'),e(x.user_code || x.id),e(date(x.created_at)),'<div class="row-actions"><button class="primary small" data-action="review-user" data-user-id="' + e(x.id) + '" data-review="approve">Approve</button><button class="danger small" data-action="review-user" data-user-id="' + e(x.id) + '" data-review="reject">Reject</button></div>']),'No pending applications.')) + '<p class="muted small-text">Approval is recorded by the protected admin API and does not credit funds.</p>';
  if (['/admin/investments','/admin/deposits','/admin/withdrawals'].includes(p)) {
    const kind = p.split('/')[2]; const rows = d[kind as 'investments'|'deposits'|'withdrawals'] || [];
    return panel(kind[0].toUpperCase()+kind.slice(1)+' records',table(['Reference','User ID','Amount','Currency','Status','Date'],rows.map(x => [e(x.investment_code || x.deposit_code || x.withdrawal_code || x.id),e(x.user_id || '—'),e(money(x.principal ?? x.amount,x.currency || 'USD')),e(x.currency),status(x.status),e(date(x.maturity_at || x.created_at))]),'No records returned.')) + '<div class="notice notice-info">Read-only view. The current API does not expose deposit settlement or withdrawal approval actions.</div>';
  }
  if (p === '/admin/treasury') return panel('Treasury accounts',table(['Account','Currency','Provider','Reference','Status','Created'],d.treasury.map(x => [e(x.account_name || '—'),e(x.currency),e(x.provider || '—'),e(x.external_reference || '—'),status(x.status),e(date(x.created_at))]),'No treasury accounts returned.')) + '<div class="notice notice-info">Currencies are displayed separately. No conversion or transfer is performed in the browser.</div>';
  if (p === '/admin/compliance') return panel('Compliance cases',table(['Case','User ID','Risk','Status','Summary','Created'],d.compliance.map(x => [e(x.case_type || '—'),e(x.user_id),status(x.risk_level),status(x.status),e(x.summary || '—'),e(date(x.created_at))]),'No compliance cases returned.'));
  if (p === '/admin/audit-logs') return panel('Recent audit records',table(['Action','Actor role','Entity','Entity ID','Reason','Created'],d.audits.map(x => [e(x.action),e(x.actor_role),e(x.entity_type),e(x.entity_id),e(x.reason || '—'),e(date(x.created_at))]),'No audit records returned.'));
  return adminContent('/admin/dashboard');
}
async function render() {
  const id = ++sequence; const p = path(); d.error = ''; d.notice = '';
  if (p === '/welcome') { app!.innerHTML = welcome(); return; }
  if (['/login/user','/login/admin','/register/user','/register/admin'].includes(p)) {
    if ((p.includes('/admin') ? 'admin' : 'user') !== ROLE) { go('/welcome'); return; }
    app!.innerHTML = authPage(p.startsWith('/register') ? 'register' : 'login'); return;
  }
  if ((ROLE === 'user' && p.startsWith('/admin')) || (ROLE === 'admin' && p.startsWith('/user'))) { app!.innerHTML = shell('<section class="state-card"><h2>Separate workspace</h2><p>This URL belongs to the other workspace. Your current screen was not redirected. Open the correct user or admin app URL to continue.</p></section>', p); return; }
  d.user = await supabase.currentUser();
  void syncInvestBrokerWebMCP(() => ({ role: ROLE, userId: d.user?.id ?? null, authenticated: !!d.user, trustedAdmin: !!d.user && isAdmin(d.user), aal2: currentAssuranceLevel() === 'aal2' }), edge);
  if (!d.user) { app!.innerHTML = authPage('login'); return; }
  if (ROLE === 'user' && isAdmin(d.user)) { app!.innerHTML = shell('<section class="state-card"><h2>Administrator account detected</h2><p>This account is restricted from the customer API. Open the Admin CEO app URL to continue.</p><button class="ghost" data-action="logout">Sign out</button></section>',p); return; }
  if (ROLE === 'admin' && !isAdmin(d.user)) { app!.innerHTML = shell('<section class="state-card"><h2>Administrator access required</h2><p>This account has no trusted admin role. Sign in with the authorized Admin CEO account.</p></section>',p); return; }
  if (ROLE === 'admin' && currentAssuranceLevel() !== 'aal2') {
    try { await showAdminMfaChallenge(); }
    catch (x) { d.error = err(x); app!.innerHTML = authPage('login'); const box=document.createElement('div'); box.className='notice notice-error'; box.textContent=d.error; app!.querySelector('.auth-card')?.prepend(box); }
    return;
  }
  app!.innerHTML = shell('<section class="state-card"><div class="spinner"></div><h2>Loading account data</h2><p>Fetching authorized records from Supabase…</p></section>',p);
  try {
    if (ROLE === 'user') await loadUser(); else await loadAdmin();
    if (id !== sequence) return;
    if (ROLE === 'user' && d.profile && (d.profile.approval_status !== 'approved' || d.profile.account_status !== 'active')) app!.innerHTML = shell(pendingPage(),p);
    else app!.innerHTML = shell(ROLE === 'user' ? userContent(p) : adminContent(p),p);
  } catch (x) {
    if (id !== sequence) return;
    d.error = err(x);
    app!.innerHTML = shell('<section class="state-card"><h2>Could not load account data</h2><p>' + e(d.error) + '</p><p class="muted">Check deployment environment variables, Edge Function availability, account approval, and database permissions. No sample data was substituted.</p><button class="primary" data-action="refresh">Try again</button></section>',p);
  }
}
async function authSubmit(event: SubmitEvent, form: HTMLFormElement) {
  event.preventDefault(); const values = new FormData(form); const email = String(values.get('email') || '').trim().toLowerCase(); const password = String(values.get('password') || '');
  const btn = form.querySelector<HTMLButtonElement>('button[type="submit"]'); if (btn) { btn.disabled = true; btn.textContent = 'Connecting…'; }
  try {
    if (!supabase.configured) throw new Error('Missing Supabase configuration. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in the deployment environment.');
    if (form.dataset.mode === 'register') {
      if (ROLE !== 'user') throw new Error('Admin registration is disabled.');
      await supabase.signUp(email,password,String(values.get('full_name') || '').trim());
      if (!supabase.session()) { app!.innerHTML = authPage('login'); const box = document.createElement('div'); box.className = 'notice notice-info'; box.textContent = 'Registration submitted. If email confirmation is enabled, confirm your email before signing in. Account access requires admin approval.'; app!.querySelector('.auth-card')?.prepend(box); return; }
      d.user = await supabase.currentUser(); go('/user/dashboard'); return;
    }
    let session = await supabase.signIn(email,password); let user = session.user;
    if (ROLE === 'admin' && !isAdmin(user) && email === 'udofiaasianubong583@gmail.com') {
      await supabase.invoke('admin-bootstrap',{}); session = await supabase.refreshSession() || session; user = await supabase.currentUser() || user;
    }
    if (ROLE === 'admin' && !isAdmin(user)) { await supabase.signOut(); throw new Error('This login does not have trusted administrator role metadata. Admin access cannot be granted by the frontend.'); }
    if (ROLE === 'user' && isAdmin(user)) { await supabase.signOut(); throw new Error('This is an administrator account. Use the Admin CEO app.'); }
    d.user = user;
    if (ROLE === 'user') { d.profile = await edge<Profile>('user-api','profile'); go('/user/dashboard'); }
    else {
      // Step up to Supabase AAL2 before any admin data request. A password login alone is not sufficient.
      await showAdminMfaChallenge();
      return;
    }
  } catch (x) {
    d.error = err(x); app!.innerHTML = authPage(form.dataset.mode === 'register' ? 'register' : 'login');
    const box = document.createElement('div'); box.className = 'notice notice-error'; box.textContent = d.error; app!.querySelector('.auth-card')?.prepend(box);
  } finally { if (btn) { btn.disabled = false; btn.textContent = form.dataset.mode === 'register' ? 'Create customer account' : 'Sign in securely'; } }
}
async function mfaSubmit(event: SubmitEvent, form: HTMLFormElement) {
  event.preventDefault();
  if (ROLE !== 'admin' || !pendingMfa) { app!.innerHTML = authPage('login'); return; }
  const code = String(new FormData(form).get('code') || '').replace(/\s/g, '');
  if (!/^\d{6}$/.test(code)) { const box=document.createElement('div'); box.className='notice notice-error'; box.textContent='Enter the 6-digit code from your authenticator app.'; form.prepend(box); return; }
  const button = form.querySelector<HTMLButtonElement>('button[type="submit"]');
  if (button) { button.disabled = true; button.textContent = 'Verifying…'; }
  try {
    const session = await supabase.verifyMfa(pendingMfa.factorId, pendingMfa.challengeId, code);
    if (!isAdmin(session.user)) throw new Error('Verified session does not have the trusted administrator role.');
    pendingMfa = null;
    d.user = session.user;
    go('/admin/dashboard');
  } catch (x) {
    const box=document.createElement('div'); box.className='notice notice-error'; box.textContent=err(x); form.prepend(box);
    if (button) { button.disabled = false; button.textContent = 'Verify and open admin dashboard'; }
  }
}

app.addEventListener('submit', event => {
  const form = event.target as HTMLFormElement;
  if (form.matches('[data-form="auth"]')) void authSubmit(event as SubmitEvent,form);
  if (form.matches('[data-form="mfa"]')) void mfaSubmit(event as SubmitEvent,form);
  if (form.matches('[data-form="admin-ai"]')) {
    event.preventDefault();
    if (ROLE !== 'admin') return;
    const question = String(new FormData(form).get('question') || '').trim();
    const button = form.querySelector<HTMLButtonElement>('button[type="submit"]');
    if (button) { button.disabled = true; button.textContent = 'Checking secure assistant…'; }
    void supabase.invoke<{data?:{answer?:string;model?:string};answer?:string;model?:string}>('admin-ai',{question}).then(result => {
      d.aiAnswer = String(result.data?.answer ?? result.answer ?? 'The assistant returned no answer.');
      d.aiModel = String(result.data?.model ?? result.model ?? 'read-only');
      return render();
    }).catch(x => {
      const box = document.createElement('div'); box.className = 'notice notice-error'; box.textContent = err(x); form.prepend(box);
    }).finally(() => { if (button) { button.disabled = false; button.textContent = 'Ask Admin AI'; } });
  }
  if (form.matches('[data-form="profile"]')) {
    event.preventDefault();
    if (ROLE !== 'user') return;
    const fd = new FormData(form);
    const full_name = String(fd.get('full_name') || '').trim();
    const button = form.querySelector<HTMLButtonElement>('button[type="submit"]');
    if (!full_name) { const box=document.createElement('div'); box.className='notice notice-error'; box.textContent='Enter your full name.'; form.prepend(box); return; }
    if (button) { button.disabled = true; button.textContent = 'Saving…'; }
    void edge<Profile>('user-api','profile','POST',{full_name}).then(profile => {
      d.profile = profile;
      d.notice = 'Profile update was accepted by the backend.';
      return render();
    }).catch(x => {
      const box=document.createElement('div'); box.className='notice notice-error';
      box.textContent = 'Profile could not be saved by the current backend: ' + err(x);
      form.prepend(box);
    }).finally(() => { if (button) { button.disabled = false; button.textContent = 'Save profile changes'; } });
  }
  if (form.matches('[data-form="support"]')) {
    event.preventDefault(); const fd = new FormData(form);
    void edge<Row>('user-api','support','POST',{subject:String(fd.get('subject')||''),body:String(fd.get('body')||'')}).then(() => { d.notice = 'Support message saved by the backend.'; return render(); }).catch(x => { d.error = err(x); const box = document.createElement('div'); box.className='notice notice-error'; box.textContent=d.error; form.prepend(box); });
  }
});
app.addEventListener('click', event => {
  const target = (event.target as HTMLElement).closest<HTMLElement>('[data-action]'); if (!target) return;
  const action = target.dataset.action;
  if (action === 'cancel-mfa') { pendingMfa = null; void supabase.signOut().finally(() => go('/login/admin')); return; }
  if (action === 'route' && target.dataset.route) { go(target.dataset.route); return; }
  if (action === 'refresh') { void render(); return; }
  if (action === 'logout') { clearInvestBrokerWebMCP(); void supabase.signOut().finally(() => { d.user = null; d.profile = null; go('/welcome'); }); return; }
  if (action === 'review-user' && ROLE === 'admin' && target.dataset.userId && target.dataset.review) {
    const review = target.dataset.review; const reason = review === 'reject' ? prompt('Optional reason for rejection:') : '';
    if (review === 'reject' && reason === null) return;
    if (!confirm((review === 'approve' ? 'Approve' : 'Reject') + ' this customer application? The server records the review.')) return;
    target.setAttribute('disabled','true');
    void edge<Row>('admin-api','users','POST',{action:review,user_id:target.dataset.userId,reason:reason || ''}).then(() => { d.notice='Application review was recorded by the backend.'; return render(); }).catch(x => { d.error=err(x); const box=document.createElement('div'); box.className='notice notice-error'; box.textContent=d.error; app!.querySelector('.topbar')?.after(box); target.removeAttribute('disabled'); });
  }
});
window.addEventListener('hashchange', () => { void render(); });

// Keep authenticated dashboards current when the tab is visible. This is a
// bounded refresh fallback; financial actions remain server-authorized and
// are never performed by this timer.
window.setInterval(() => {
  if (document.hidden || !d.user) return;
  const active = document.activeElement;
  if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement || active instanceof HTMLSelectElement) return;
  const current = path();
  if (current.startsWith('/user/') || current.startsWith('/admin/')) void render();
}, 15000);

document.addEventListener('visibilitychange', () => {
  if (!document.hidden && d.user && (path().startsWith('/user/') || path().startsWith('/admin/'))) void render();
});
void render();
