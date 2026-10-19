create or replace function public.bootstrap_primary_admin(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_email text;
  v_confirmed_at timestamptz;
  v_existing uuid;
begin
  select email, email_confirmed_at
    into v_email, v_confirmed_at
    from auth.users
   where id = p_user_id
   for update;

  if not found then
    raise exception 'Administrator account was not found';
  end if;
  if lower(coalesce(v_email, '')) <> 'udofiaasianubong583@gmail.com' then
    raise exception 'Only the designated administrator email can be assigned';
  end if;
  if v_confirmed_at is null then
    raise exception 'Confirm the designated email before completing administrator setup';
  end if;

  select primary_admin_user_id
    into v_existing
    from public.platform_control
   where singleton = true
   for update;

  if not found then
    raise exception 'Primary administrator control row is missing';
  end if;
  if v_existing is not null and v_existing <> p_user_id then
    raise exception 'The single primary administrator has already been assigned';
  end if;

  update auth.users
     set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb,
         updated_at = now()
   where id = p_user_id;

  update public.platform_control
     set primary_admin_user_id = p_user_id
   where singleton = true
     and (primary_admin_user_id is null or primary_admin_user_id = p_user_id);

  return jsonb_build_object('success', true, 'primary_admin_user_id', p_user_id);
end;
$$;

revoke all on function public.bootstrap_primary_admin(uuid) from public, anon, authenticated;
grant execute on function public.bootstrap_primary_admin(uuid) to service_role;
