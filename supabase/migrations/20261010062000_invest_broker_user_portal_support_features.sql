-- Customer portal extensions: masked payout accounts, notifications, documents and complaints.
create table if not exists public.user_bank_accounts (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles(id) on delete restrict,
 provider_name text not null,
 account_name text not null,
 account_last4 text not null check (account_last4 ~ '^[0-9]{4}$'),
 provider_token text,
 status text not null default 'pending' check (status in ('pending','verified','rejected','disabled')),
 is_primary boolean not null default false,
 created_at timestamptz not null default now(),
 verified_at timestamptz
);
create index if not exists user_bank_accounts_owner_idx on public.user_bank_accounts(user_id,created_at desc);

create table if not exists public.user_notifications (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles(id) on delete restrict,
 notification_type text not null, title text not null, body text not null,
 related_entity_type text, related_entity_id uuid, read_at timestamptz,
 created_at timestamptz not null default now()
);
create index if not exists user_notifications_owner_idx on public.user_notifications(user_id,created_at desc);

create table if not exists public.user_documents (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles(id) on delete restrict,
 document_type text not null, title text not null, storage_path text, version text,
 status text not null default 'available' check (status in ('available','pending','expired','withdrawn')),
 created_at timestamptz not null default now()
);
create index if not exists user_documents_owner_idx on public.user_documents(user_id,created_at desc);

create table if not exists public.user_complaints (
 id uuid primary key default gen_random_uuid(),
 complaint_code text not null unique default ('CMP-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,10))),
 user_id uuid not null references public.profiles(id) on delete restrict,
 category text not null check (category in ('account','deposit','withdrawal','investment','profit','security','other')),
 subject text not null check (length(subject) between 3 and 200),
 description text not null check (length(description) between 10 and 10000),
 status text not null default 'submitted' check (status in ('submitted','acknowledged','in_review','resolved','closed')),
 assigned_to uuid references auth.users(id), resolution text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists user_complaints_owner_idx on public.user_complaints(user_id,created_at desc);

alter table public.user_bank_accounts enable row level security;
alter table public.user_notifications enable row level security;
alter table public.user_documents enable row level security;
alter table public.user_complaints enable row level security;
revoke all on public.user_bank_accounts,public.user_notifications,public.user_documents,public.user_complaints from anon,authenticated;
grant select on public.user_bank_accounts,public.user_notifications,public.user_documents,public.user_complaints to authenticated;
grant insert on public.user_complaints to authenticated;
grant update(read_at) on public.user_notifications to authenticated;

create policy bank_accounts_read_owner_or_manager on public.user_bank_accounts for select to authenticated
using (user_id=(select auth.uid()) or ((select auth.jwt())->'app_metadata'->>'role') in ('admin','manager'));
create policy notifications_read_owner_or_manager on public.user_notifications for select to authenticated
using (user_id=(select auth.uid()) or ((select auth.jwt())->'app_metadata'->>'role') in ('admin','manager'));
create policy notifications_mark_read_own on public.user_notifications for update to authenticated
using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
create policy documents_read_owner_or_manager on public.user_documents for select to authenticated
using (user_id=(select auth.uid()) or ((select auth.jwt())->'app_metadata'->>'role') in ('admin','manager'));
create policy complaints_read_owner_or_manager on public.user_complaints for select to authenticated
using (user_id=(select auth.uid()) or ((select auth.jwt())->'app_metadata'->>'role') in ('admin','manager'));
create policy complaints_insert_own on public.user_complaints for insert to authenticated
with check (user_id=(select auth.uid()));
revoke update,delete,truncate,references,trigger on public.user_bank_accounts,public.user_notifications,public.user_documents,public.user_complaints from anon,authenticated;
