-- 0014_admin_revoke_user_sessions.sql
-- Révoque toutes les sessions d'un utilisateur (déconnexion forcée).
--
-- Appelée par le backend (service_role) après un changement d'email admin :
-- l'ancienne session ne doit plus rester connectée avec l'ancienne adresse.
--
-- PostgREST n'expose que le schéma `public` (jamais `auth`). Cette fonction
-- `security definer` (propriétaire = rôle avec accès à `auth`) permet au backend
-- de supprimer les sessions de l'utilisateur. La suppression de `auth.sessions`
-- cascade sur `auth.refresh_tokens` → le refresh token est invalidé ; l'access
-- token JWT déjà émis reste valide jusqu'à son expiration (~1 h), comportement
-- identique au signOut global de Supabase.

create or replace function public.admin_revoke_user_sessions(uid uuid)
returns void
language sql
security definer
set search_path = auth, public
as $$
  delete from auth.sessions where user_id = uid;
$$;

-- Réservé au backend service_role : on retire l'accès aux rôles publics.
revoke all on function public.admin_revoke_user_sessions(uuid) from public, anon, authenticated;
grant execute on function public.admin_revoke_user_sessions(uuid) to service_role;
