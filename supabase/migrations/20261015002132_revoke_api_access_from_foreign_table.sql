-- Security hardening: foreign tables do not enforce Supabase RLS.
-- Remove access through API roles; retain owner/service-role access for trusted server-side use.
REVOKE ALL PRIVILEGES ON TABLE public."Invest-broker c" FROM anon, authenticated;
