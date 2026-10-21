-- Fail closed at the database boundary: no server caller can post a ledger transaction
-- while platform financial operations are disabled. Posting remains atomic in one transaction.
create or replace function public.post_ledger_transaction(p_transaction_id uuid)
returns public.ledger_transactions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tx public.ledger_transactions%rowtype;
  v_line_count integer;
begin
  select * into v_tx
  from public.ledger_transactions
  where id = p_transaction_id
  for update;

  if not found then
    raise exception 'Ledger transaction not found';
  end if;

  if not exists (
    select 1
    from public.platform_control
    where singleton is true
      and financial_operations_enabled is true
  ) then
    raise exception 'Financial operations are disabled';
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
    from public.ledger_entries
    where transaction_id = p_transaction_id
      and (status <> 'pending' or posted_at is not null)
  ) then
    raise exception 'All ledger entries must be pending and unposted';
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

  if exists (
    select 1
    from public.ledger_entries
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
