-- Invest Broker shared User/Admin foundation.
-- Financial mutations are backend-only until reviewed transactional functions and provider integrations are deployed.
create sequence public.user_code_seq start 1;
create sequence public.wallet_code_seq start 1;
create sequence public.investment_code_seq start 1;
create sequence public.withdrawal_code_seq start 1;
create sequence public.deposit_code_seq start 1;

create table public.profiles (
 id uuid primary key references auth.users(id) on delete restrict,
 user_code text not null unique default ('USR-'||lpad(nextval('public.user_code_seq')::text,6,'0')),
 full_name text, phone text,
 kyc_status text not null default 'pending' check (kyc_status in ('pending','in_review','verified','rejected','expired')),
 account_status text not null default 'pending_kyc' check (account_status in ('pending_kyc','active','restricted','suspended','closed')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.wallets (
 id uuid primary key default gen_random_uuid(),
 wallet_code text not null unique default ('WAL-'||lpad(nextval('public.wallet_code_seq')::text,6,'0')),
 user_id uuid not null unique references public.profiles(id) on delete restrict,
 currency text not null default 'NGN' check (currency ~ '^[A-Z]{3}$'),
 status text not null default 'active' check (status in ('active','restricted','frozen','closed')),
 created_at timestamptz not null default now()
);
create table public.investment_plans (
 id uuid primary key default gen_random_uuid(), name text not null, description text,
 currency text not null default 'NGN' check (currency ~ '^[A-Z]{3}$'),
 minimum_amount numeric(20,2) not null check (minimum_amount>0),
 maximum_amount numeric(20,2) check (maximum_amount is null or maximum_amount>=minimum_amount),
 duration_days integer not null check (duration_days>0),
 return_rate numeric(9,6) not null default 0 check (return_rate>=0),
 return_method text not null default 'fixed' check (return_method in ('fixed','simple','compound','variable')),
 withdrawal_window_days integer not null default 0 check (withdrawal_window_days>=0),
 is_active boolean not null default false, terms_version text not null default 'v1',
 created_by uuid references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.investments (
 id uuid primary key default gen_random_uuid(),
 investment_code text not null unique default ('INV-'||lpad(nextval('public.investment_code_seq')::text,6,'0')),
 user_id uuid not null references public.profiles(id) on delete restrict,
 plan_id uuid not null references public.investment_plans(id) on delete restrict,
 principal numeric(20,2) not null check (principal>0),
 currency text not null default 'NGN' check (currency ~ '^[A-Z]{3}$'),
 status text not null default 'pending' check (status in ('pending','active','matured','cancelled','under_review')),
 started_at timestamptz, maturity_at timestamptz, created_at timestamptz not null default now(),
 created_by uuid references auth.users(id)
);
create table public.ledger_entries (
 id uuid primary key default gen_random_uuid(), user_id uuid references public.profiles(id) on delete restrict,
 wallet_id uuid references public.wallets(id) on delete restrict,
 entry_type text not null check (entry_type in ('deposit','withdrawal','principal_debit','principal_return','profit_credit','fee','adjustment','reversal','treasury_transfer')),
 amount numeric(20,2) not null check (amount<>0), currency text not null default 'NGN' check (currency ~ '^[A-Z]{3}$'),
 status text not null default 'pending' check (status in ('pending','posted','reversed','failed')),
 reference text not null unique, related_entity_type text, related_entity_id uuid, description text,
 idempotency_key text unique, created_by uuid references auth.users(id), created_at timestamptz not null default now(), posted_at timestamptz
);
create table public.deposits (
 id uuid primary key default gen_random_uuid(),
 deposit_code text not null unique default ('DEP-'||lpad(nextval('public.deposit_code_seq')::text,6,'0')),
 user_id uuid not null references public.profiles(id) on delete restrict,
 amount numeric(20,2) not null check (amount>0), currency text not null default 'NGN' check (currency ~ '^[A-Z]{3}$'),
 status text not null default 'pending' check (status in ('pending','processing','confirmed','failed','cancelled')),
 provider text, provider_reference text unique, idempotency_key text unique, created_at timestamptz not null default now(), confirmed_at timestamptz
);
create table public.withdrawals (
 id uuid primary key default gen_random_uuid(),
 withdrawal_code text not null unique default ('WD-'||lpad(nextval('public.withdrawal_code_seq')::text,6,'0')),
 user_id uuid not null references public.profiles(id) on delete restrict,
 amount numeric(20,2) not null check (amount>0), currency text not null default 'NGN' check (currency ~ '^[A-Z]{3}$'),
 status text not null default 'pending' check (status in ('pending','under_review','approved','rejected','processing','completed','failed','cancelled')),
 destination_token text, provider text, provider_reference text unique, idempotency_key text unique,
 reviewed_by uuid references auth.users(id), review_reason text, created_at timestamptz not null default now(), reviewed_at timestamptz, completed_at timestamptz
);
create table public.support_messages (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete restrict,
 sender_id uuid references auth.users(id), sender_role text not null check (sender_role in ('user','manager','system')),
 subject text, body text not null check (length(body) between 1 and 10000), read_at timestamptz, created_at timestamptz not null default now()
);
create table public.compliance_cases (
 id uuid primary key default gen_random_uuid(), user_id uuid references public.profiles(id) on delete restrict,
 case_type text not null check (case_type in ('kyc','aml','withdrawal_review','account_restriction','complaint','other')),
 status text not null default 'open' check (status in ('open','in_review','on_hold','resolved','closed')),
 risk_level text not null default 'medium' check (risk_level in ('low','medium','high','critical')),
 summary text not null, assigned_to uuid references auth.users(id), resolution text, created_at timestamptz not null default now(), resolved_at timestamptz
);
create table public.treasury_accounts (
 id uuid primary key default gen_random_uuid(), account_name text not null,
 currency text not null default 'NGN' check (currency ~ '^[A-Z]{3}$'), provider text, external_reference text,
 status text not null default 'active' check (status in ('active','restricted','closed')), created_at timestamptz not null default now()
);
create table public.audit_logs (
 id bigint generated always as identity primary key, actor_id uuid references auth.users(id),
 actor_role text not null default 'system', action text not null, entity_type text not null, entity_id text,
 request_id text, reason text, before_state jsonb, after_state jsonb, created_at timestamptz not null default now()
);

create index investments_user_created_idx on public.investments(user_id,created_at desc);
create index ledger_user_created_idx on public.ledger_entries(user_id,created_at desc);
create index withdrawals_user_created_idx on public.withdrawals(user_id,created_at desc);
create index deposits_user_created_idx on public.deposits(user_id,created_at desc);
create index support_messages_user_created_idx on public.support_messages(user_id,created_at desc);
create index compliance_cases_status_created_idx on public.compliance_cases(status,created_at desc);
create index audit_logs_entity_created_idx on public.audit_logs(entity_type,entity_id,created_at desc);

create function public.handle_new_invest_broker_user() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.profiles(id,full_name,phone) values (new.id,coalesce(new.raw_user_meta_data->>'full_name',new.raw_user_meta_data->>'name'),new.raw_user_meta_data->>'phone') on conflict(id) do nothing;
 insert into public.wallets(user_id) values(new.id) on conflict(user_id) do nothing;
 return new;
end; $$;
create trigger on_auth_user_created_invest_broker after insert on auth.users for each row execute function public.handle_new_invest_broker_user();
revoke all on function public.handle_new_invest_broker_user() from public,anon,authenticated;

alter table public.profiles enable row level security;
alter table public.wallets enable row level security;
alter table public.investment_plans enable row level security;
alter table public.investments enable row level security;
alter table public.ledger_entries enable row level security;
alter table public.deposits enable row level security;
alter table public.withdrawals enable row level security;
alter table public.support_messages enable row level security;
alter table public.compliance_cases enable row level security;
alter table public.treasury_accounts enable row level security;
alter table public.audit_logs enable row level security;

revoke all on public.profiles,public.wallets,public.investment_plans,public.investments,public.ledger_entries,public.deposits,public.withdrawals,public.support_messages,public.compliance_cases,public.treasury_accounts,public.audit_logs from anon,authenticated;
grant select on public.profiles,public.wallets,public.investment_plans,public.investments,public.ledger_entries,public.deposits,public.withdrawals,public.support_messages to authenticated;
grant insert on public.support_messages to authenticated;

create policy profiles_read_self_or_manager on public.profiles for select to authenticated using (id=(select auth.uid()) or ((select auth.jwt())->'app_metadata'->>'role') in ('admin','manager'));
create policy wallets_read_self_or_manager on public.wallets for select to authenticated using (user_id=(select auth.uid()) or ((select auth.jwt())->'app_metadata'->>'role') in ('admin','manager'));
create policy plans_read_active_or_manager on public.investment_plans for select to authenticated using (is_active or ((select auth.jwt())->'app_metadata'->>'role') in ('admin','manager'));
create policy investments_read_owner_or_manager on public.investments for select to authenticated using (user_id=(select auth.uid()) or ((select auth.jwt())->'app_metadata'->>'role') in ('admin','manager'));
create policy ledger_read_owner_or_manager on public.ledger_entries for select to authenticated using (user_id=(select auth.uid()) or ((select auth.jwt())->'app_metadata'->>'role') in ('admin','manager'));
create policy deposits_read_owner_or_manager on public.deposits for select to authenticated using (user_id=(select auth.uid()) or ((select auth.jwt())->'app_metadata'->>'role') in ('admin','manager'));
create policy withdrawals_read_owner_or_manager on public.withdrawals for select to authenticated using (user_id=(select auth.uid()) or ((select auth.jwt())->'app_metadata'->>'role') in ('admin','manager'));
create policy support_messages_read_owner_or_manager on public.support_messages for select to authenticated using (user_id=(select auth.uid()) or ((select auth.jwt())->'app_metadata'->>'role') in ('admin','manager'));
create policy support_messages_insert_own on public.support_messages for insert to authenticated with check (user_id=(select auth.uid()) and sender_id=(select auth.uid()) and sender_role='user');
create policy compliance_cases_manager_only on public.compliance_cases for all to authenticated using (((select auth.jwt())->'app_metadata'->>'role') in ('admin','manager')) with check (((select auth.jwt())->'app_metadata'->>'role') in ('admin','manager'));
create policy treasury_accounts_manager_only on public.treasury_accounts for select to authenticated using (((select auth.jwt())->'app_metadata'->>'role') in ('admin','manager'));
create policy audit_logs_manager_read_only on public.audit_logs for select to authenticated using (((select auth.jwt())->'app_metadata'->>'role') in ('admin','manager'));

revoke insert,update,delete,truncate,references,trigger on public.profiles,public.wallets,public.investment_plans,public.investments,public.ledger_entries,public.deposits,public.withdrawals,public.compliance_cases,public.treasury_accounts,public.audit_logs from anon,authenticated;
revoke update,delete,truncate,references,trigger on public.support_messages from anon,authenticated;
