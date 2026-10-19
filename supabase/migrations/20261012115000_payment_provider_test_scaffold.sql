-- Test-only payment architecture scaffold. No provider credentials or wallet-credit path are enabled.
create table if not exists public.payment_provider_registry (
  provider text primary key check (provider in ('paycanvas','payu','crypto_wallet')),
  display_name text not null,
  integration_status text not null default 'unverified'
    check (integration_status in ('unverified','configured_test','test_verified','production_approved','disabled')),
  test_mode_only boolean not null default true,
  checkout_enabled boolean not null default false,
  wallet_credit_enabled boolean not null default false,
  notes text not null default 'Provider API/capabilities not yet verified.',
  updated_at timestamptz not null default now()
);
insert into public.payment_provider_registry (provider, display_name, integration_status, test_mode_only, checkout_enabled, wallet_credit_enabled, notes)
values
  ('paycanvas','PayCanvas','unverified',true,false,false,'API contract and merchant capabilities must be verified before implementation.'),
  ('payu','PayU','unverified',true,false,false,'Merchant account, country eligibility, and enabled payment methods must be confirmed.'),
  ('crypto_wallet','Direct cryptocurrency wallet','unverified',true,false,false,'Receiving address, supported networks/assets, custody, and confirmation source must be configured.')
on conflict (provider) do nothing;
create table if not exists public.payment_intents (
  id uuid primary key default gen_random_uuid(),
  intent_code text not null unique default ('PAY-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,12))),
  user_id uuid not null references public.profiles(id) on delete restrict,
  provider text not null references public.payment_provider_registry(provider) on delete restrict,
  intent_type text not null check (intent_type in ('fiat_checkout','crypto_wallet')),
  amount numeric(24,10) not null check (amount > 0),
  currency text not null check (currency ~ '^[A-Z0-9]{2,12}$'),
  asset_symbol text,
  network text,
  receiving_address text,
  transaction_hash text,
  provider_reference text,
  provider_event_id text,
  idempotency_key text not null unique,
  status text not null default 'pending'
    check (status in ('pending','awaiting_payment','confirming','confirmed_uncredited','credited','failed','expired','under_review','cancelled')),
  confirmations integer not null default 0 check (confirmations >= 0),
  required_confirmations integer check (required_confirmations is null or required_confirmations > 0),
  provider_verified boolean not null default false,
  credited_at timestamptz,
  expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  confirmed_at timestamptz,
  constraint crypto_intent_asset_network check (intent_type <> 'crypto_wallet' or (asset_symbol is not null and network is not null))
);
create unique index if not exists payment_intents_provider_reference_uq on public.payment_intents(provider, provider_reference) where provider_reference is not null;
create unique index if not exists payment_intents_provider_event_uq on public.payment_intents(provider, provider_event_id) where provider_event_id is not null;
create unique index if not exists payment_intents_network_tx_hash_uq on public.payment_intents(lower(network), lower(transaction_hash)) where transaction_hash is not null and network is not null;
create index if not exists payment_intents_user_created_idx on public.payment_intents(user_id, created_at desc);
create index if not exists payment_intents_status_created_idx on public.payment_intents(status, created_at desc);
alter table public.payment_provider_registry enable row level security;
alter table public.payment_intents enable row level security;
revoke all on public.payment_provider_registry from anon, authenticated;
revoke all on public.payment_intents from anon, authenticated;
grant all on public.payment_provider_registry to service_role;
grant all on public.payment_intents to service_role;
