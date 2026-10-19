-- Keep platform ownership configuration inaccessible to browser roles.
-- The server-side service_role Edge Functions bypass RLS and remain responsible
-- for reading/updating this singleton control record.
create policy platform_control_deny_client_access
  on public.platform_control
  for all
  to anon, authenticated
  using (false)
  with check (false);
