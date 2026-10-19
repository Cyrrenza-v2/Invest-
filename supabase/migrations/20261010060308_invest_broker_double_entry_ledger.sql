-- Double-entry, append-only financial ledger foundation.
-- Existing legacy ledger_entries rows remain readable; new financial events use
-- ledger_transactions plus balanced debit/credit fields and server-only posting.
create table public.ledger_accounts (
  id uuid primary key default gen_random_uuid(),
  account_code text not null unique,
  account_name text not null,
  account_type text not null check (account_type in (
    'customer_wallet','customer_investment','customer_return',
    'company_operating','company_treasury','payment_clearing','fees','suspense'
  )),
  owner_user_id uuid references public.profiles(id) on delete restrict,
  currency text not null default 'NGN' check (currency ~ '^[A-Z]{3}$'),
  status text not null default 'active' check (status in ('active','restricted','closed')),
  created_at timestamptz not null default now(),
  constraint ledger_account_owner_type_check check (
    (account_type in ('customer_wallet','customer_investment','customer_return') and owner_user_id is not null)
    or (account_type not in ('customer_wallet','customer_investment','customer_return') and owner_user_id is null)
  )
);

create table public.ledger_transactions (
  id uuid primary key default gen_random_uuid(),
  transaction_reference text not null unique,
  transaction_type text not null check (transaction_type in (
    'deposit','investment','return','withdrawal','refund','fee','adjustment','transfer','reversal'
  )),
  status text not null default 'draft' check (status in ('draft','posted','reversed','failed')),
  description text not null,
  idempotency_key text unique,
  related_entity_type text,
  related_entity_id uuid,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.ledger_entries
  add column transaction_id uuid references public.ledger_transactions(id) on delete restrict,
  add column ledger_account_id uuid references public.ledger_accounts(id) on delete restrict,
  add column debit_amount numeric(20,2) not null default 0 check (debit_amount >= 0),
  add column credit_amount numeric(20,2) not null default 0 check (credit_amount >= 0);

alter table public.ledger_entries
  add constraint ledger_entries_double_entry_side_check
  check (
    (transaction_id is null and ledger_account_id is null and debit_amount = 0 and credit_amount = 0)
    or
    (transaction_id is not null and ledger_account_id is not null
      and ((debit_amount > 0 and credit_amount = 0) or (credit_amount > 0 and debit_amount = 0))
      and amount = debit_amount - credit_amount)
  );

create index ledger_transactions_created_idx on public.ledger_transactions(created_at desc);
create index ledger_transactions_type_status_idx on public.ledger_transactions(transaction_type,status,created_at desc);
create index ledger_entries_transaction_idx on public.ledger_entries(transaction_id) where transaction_id is not null;
create index ledger_entries_account_created_idx on public.ledger_entries(ledger_account_id,created_at desc) where ledger_account_id is not null;

alter table public.ledger_accounts enable row level security;
alter table public.ledger_transactions enable row level security;
revoke all on public.ledger_accounts, public.ledger_transactions from anon, authenticated;
revoke insert, update, delete, truncate, references, trigger on public.ledger_entries from anon, authenticated;
grant select on public.ledger_accounts, public.ledger_transactions to authenticated;

create policy ledger_accounts_read_owner_or_manager on public.ledger_accounts
for select to authenticated using (
  owner_user_id = (select auth.uid())
  or (select auth.jwt())->'app_metadata'->>'role' in ('admin','manager')
);
create policy ledger_transactions_read_manager_only on public.ledger_transactions
for select to authenticated using (
  (select auth.jwt())->'app_metadata'->>'role' in ('admin','manager')
  or exists (
    select 1 from public.ledger_entries e
    where e.transaction_id = ledger_transactions.id and e.user_id = (select auth.uid())
  )
);

create or replace function public.prevent_ledger_entry_mutation()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'Ledger entries are append-only; post a correcting reversal instead of editing or deleting.';
end;
$$;
revoke all on function public.prevent_ledger_entry_mutation() from public, anon, authenticated;
create trigger ledger_entries_append_only
before update or delete on public.ledger_entries
for each row execute function public.prevent_ledger_entry_mutation();

create or replace function public.prevent_posted_ledger_transaction_mutation()
returns trigger language plpgsql set search_path = '' as $$
begin
  if old.status in ('posted','reversed') then
    raise exception 'Posted ledger transactions are immutable; create a compensating transaction.';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;
revoke all on function public.prevent_posted_ledger_transaction_mutation() from public, anon, authenticated;
create trigger ledger_transactions_posted_immutable
before update or delete on public.ledger_transactions
for each row execute function public.prevent_posted_ledger_transaction_mutation();

create or replace function public.post_ledger_transaction(p_transaction_id uuid)
returns public.ledger_transactions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tx public.ledger_transactions%rowtype;
  v_line_count integer;
  v_unbalanced_count integer;
begin
  select * into v_tx
  from public.ledger_transactions
  where id = p_transaction_id
  for update;

  if not found then
    raise exception 'Ledger transaction not found';
  end if;
  if v_tx.status <> 'draft' then
    raise exception 'Only draft ledger transactions can be posted';
  end if;

  select count(*) into v_line_count
  from public.ledger_entries
  where transaction_id = p_transaction_id;

  if v_line_count < 2 then
    raise exception 'A ledger transaction requires at least two entries';
  end if;

  if exists (
    select 1
    from public.ledger_entries e
    join public.ledger_accounts a on a.id = e.ledger_account_id
    where e.transaction_id = p_transaction_id
      and (e.currency <> a.currency or a.status <> 'active')
  ) then
    raise exception 'Ledger account currency mismatch or account is not active';
  end if;

  select count(*) into v_unbalanced_count
  from (
    select currency
    from public.ledger_entries
    where transaction_id = p_transaction_id
    group by currency
    having sum(debit_amount) <> sum(credit_amount)
       or sum(debit_amount) <= 0
  ) balances;

  if v_unbalanced_count > 0 or exists (
    select 1 from public.ledger_entries
    where transaction_id = p_transaction_id
    group by currency
    having sum(debit_amount) <> sum(credit_amount)
       or sum(debit_amount) <= 0
  ) then
    raise exception 'Ledger transaction is not balanced by currency';
  end if;

  update public.ledger_entries
  set status = 'posted', posted_at = now()
  where transaction_id = p_transaction_id and status = 'pending';

  update public.ledger_transactions
  set status = 'posted', completed_at = now()
  where id = p_transaction_id
  returning * into v_tx;

  insert into public.audit_logs(actor_id,actor_role,action,entity_type,entity_id,reason,after_state)
  values (auth.uid(),'system','ledger_transaction_posted','ledger_transaction',p_transaction_id::text,
          'Server-side balanced double-entry posting',
          jsonb_build_object('transaction_reference',v_tx.transaction_reference,
                             'transaction_type',v_tx.transaction_type,
                             'status',v_tx.status));

  return v_tx;
end;
$$;
revoke all on function public.post_ledger_transaction(uuid) from public, anon, authenticated;
grant execute on function public.post_ledger_transaction(uuid) to service_role;

create or replace function public.prevent_audit_log_mutation()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'Audit logs are append-only.';
end;
$$;
revoke all on function public.prevent_audit_log_mutation() from public, anon, authenticated;
create trigger audit_logs_append_only
before update or delete on public.audit_logs
for each row execute function public.prevent_audit_log_mutation();

revoke insert, update, delete, truncate, references, trigger on public.audit_logs from anon, authenticated;
