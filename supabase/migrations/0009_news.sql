-- 0009_news.sql
-- Table `news` : actualités de l'AEGP affichées sur la page d'accueil.
-- Prérequis : 0001_profiles.sql doit être appliqué (les policies BDE en dépendent).
--
-- Accès : SELECT public (page d'accueil et /actualites accessibles aux visiteurs
-- sans compte), INSERT/UPDATE/DELETE réservés aux membres BDE et admins.

create table public.news (
  id          uuid primary key default gen_random_uuid(),
  title       text not null check (char_length(title) between 1 and 200),
  content     text not null check (char_length(content) between 1 and 5000),
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);

create index news_created_at_idx on public.news (created_at desc);

alter table public.news enable row level security;

-- SELECT : public (visiteurs non connectés inclus)
create policy news_select_public
  on public.news for select
  to anon, authenticated
  using (true);

-- INSERT : membres BDE uniquement, en leur nom
create policy news_insert_bde
  on public.news for insert
  to authenticated
  with check (
    created_by = auth.uid()
    and exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and (profiles.is_bde_member = true or profiles.is_admin = true)
    )
  );

-- UPDATE : membres BDE
create policy news_update_bde
  on public.news for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and (profiles.is_bde_member = true or profiles.is_admin = true)
    )
  );

-- DELETE : membres BDE
create policy news_delete_bde
  on public.news for delete
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and (profiles.is_bde_member = true or profiles.is_admin = true)
    )
  );
