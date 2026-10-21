-- Safe regression test for the database financial-operation kill switch.
-- Run only in a disposable/staging database with financial_operations_enabled=false.
-- All test data is rolled back. This test intentionally does not exercise live posting.
begin;

do $$
declare
  v_transaction_id uuid;
  v_error text;
begin
  if exists (
    select 1 from public.platform_control
    where singleton is true and financial_operations_enabled is true
  ) then
    raise exception 'Refusing test: financial operations are enabled';
  end if;

  insert into public.ledger_transactions (
    transaction_reference, transaction_type, status, description, idempotency_key
  ) values (
    'TEST-GATE-' || gen_random_uuid()::text,
    'adjustment',
    'draft',
    'Automated safety-gate regression test',
    'test-gate-' || gen_random_uuid()::text
  ) returning id into v_transaction_id;

  begin
    perform public.post_ledger_transaction(v_transaction_id);
    raise exception 'Expected financial-operation gate to reject posting';
  exception when others then
    get stacked diagnostics v_error = message_text;
    if v_error <> 'Financial operations are disabled' then
      raise exception 'Unexpected failure while testing financial gate: %', v_error;
    end if;
  end;
end;
$$;

rollback;
