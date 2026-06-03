-- 0002_ideas.sql
-- Table `ideas` : boîte à idées privée du BDE.
-- Cf. docs/BOITE-IDEES-BDD.md pour le contexte fonctionnel.
-- Prérequis : 0001_profiles.sql doit être appliqué d'abord (les policies SELECT/UPDATE en dépendent).

create type public.idea_status as enum (
  'nouvelle',
  'en_etude',
  'realisee',
  'refusee'
);

create table public.ideas (
  id          uuid primary key default gen_random_uuid(),
  title       text not null check (char_length(title) between 1 and 200),
  description text not null check (char_length(description) between 1 and 5000),
  status      public.idea_status not null default 'nouvelle',
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);

create index ideas_status_idx on public.ideas (status);
create index ideas_created_at_idx on public.ideas (created_at desc);

alter table public.ideas enable row level security;

-- INSERT : tout utilisateur authentifié peut déposer une idée en son nom.
create policy ideas_insert_own
  on public.ideas for insert
  to authenticated
  with check (created_by = auth.uid());

-- SELECT : seuls les membres BDE (ou admins) peuvent lister les idées.
create policy ideas_select_bde
  on public.ideas for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and (profiles.is_bde_member = true or profiles.is_admin = true)
    )
  );

-- UPDATE : seuls les membres BDE peuvent modifier (en pratique, le statut).
-- Note v1 : cette policy autorise techniquement à modifier tous les champs.
-- Acceptable car réservée aux membres BDE de confiance ; à durcir via RPC si besoin futur.
create policy ideas_update_bde
  on public.ideas for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and (profiles.is_bde_member = true or profiles.is_admin = true)
    )
  );
