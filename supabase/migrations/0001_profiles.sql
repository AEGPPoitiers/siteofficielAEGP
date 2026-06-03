-- 0001_profiles.sql
-- Création de la table `profiles` : extension de auth.users avec les flags de rôle BDE/admin.
-- Préalable nécessaire à toute fonctionnalité gardée par un rôle (boîte à idées, agenda admin, tutorat).

create table public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  full_name     text,
  is_bde_member boolean not null default false,
  is_admin      boolean not null default false,
  created_at    timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Tout utilisateur authentifié peut lire les profils (utile pour afficher des noms côté UI).
create policy profiles_select_authenticated
  on public.profiles for select
  to authenticated
  using (true);

-- Création automatique du profil quand un utilisateur s'inscrit via Supabase Auth.
-- `security definer` permet à la fonction de contourner la RLS pour l'INSERT initial.
-- `set search_path = public` durcit la sécurité (cf. recommandation Supabase).
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill : créer les profils manquants pour les comptes auth déjà existants
-- (utilisateurs créés avant que cette table existe).
insert into public.profiles (id, full_name)
select id, raw_user_meta_data->>'full_name'
from auth.users
where id not in (select id from public.profiles);
