-- Explicitly deny browser-role access to provider/payment integration internals.
-- Supabase service_role bypasses RLS and remains the only intended server-side access path.
create policy "deny browser access to payment intents"
on public.payment_intents
for all
to anon, authenticated
using (false)
with check (false);

create policy "deny browser access to payment provider registry"
on public.payment_provider_registry
for all
to anon, authenticated
using (false)
with check (false);
