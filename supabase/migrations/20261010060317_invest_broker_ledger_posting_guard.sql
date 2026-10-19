-- Allow only the controlled pending -> posted transition performed by post_ledger_transaction.
-- All financial payload fields remain immutable; posted entries cannot be changed or deleted.
create or replace function public.prevent_ledger_entry_mutation()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE'
     and old.status = 'pending'
     and new.status = 'posted'
     and old.posted_at is null
     and new.posted_at is not null
     and (to_jsonb(new) - 'status' - 'posted_at') = (to_jsonb(old) - 'status' - 'posted_at') then
    return new;
  end if;
  raise exception 'Ledger entries are append-only; only server posting may transition pending entries to posted. Use a correcting reversal instead of editing or deleting.';
end;
$$;
