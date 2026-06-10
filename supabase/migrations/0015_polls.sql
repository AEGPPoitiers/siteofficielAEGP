-- 0015_polls.sql
-- Système de sondages (polls) de l'AEGP.
-- Prérequis : 0001_profiles.sql doit être appliqué (les policies admin en dépendent).
--
-- Règles fonctionnelles :
--   - Création / clôture / suppression d'un sondage : admins uniquement (is_admin).
--   - Vote : tout utilisateur authentifié, un seul choix par sondage, modifiable
--     tant que le sondage est ouvert (non clôturé).
--   - Résultats : visibles de tous APRÈS clôture seulement. Avant clôture, personne
--     (hors admin) ne peut recompter les votes — la table `poll_votes` n'expose à
--     chacun que ses propres lignes, et l'agrégat passe par la fonction
--     `get_poll_results` (security definer) qui ne renvoie les comptes que si le
--     sondage est clôturé (ou si le demandeur est admin).

-- ─── Tables ──────────────────────────────────────────────────────────────────

create table public.polls (
  id          uuid primary key default gen_random_uuid(),
  question    text not null check (char_length(question) between 1 and 300),
  is_closed   boolean not null default false,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  closed_at   timestamptz
);

create table public.poll_options (
  id        uuid primary key default gen_random_uuid(),
  poll_id   uuid not null references public.polls(id) on delete cascade,
  label     text not null check (char_length(label) between 1 and 200),
  position  integer not null default 0
);

create table public.poll_votes (
  id          uuid primary key default gen_random_uuid(),
  poll_id     uuid not null references public.polls(id) on delete cascade,
  option_id   uuid not null references public.poll_options(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  -- un seul vote par utilisateur et par sondage (la modification se fait par UPDATE)
  unique (poll_id, user_id)
);

create index polls_created_at_idx on public.polls (created_at desc);
create index poll_options_poll_id_idx on public.poll_options (poll_id);
create index poll_votes_poll_id_idx on public.poll_votes (poll_id);
create index poll_votes_option_id_idx on public.poll_votes (option_id);

alter table public.polls enable row level security;
alter table public.poll_options enable row level security;
alter table public.poll_votes enable row level security;

-- ─── RLS : polls ─────────────────────────────────────────────────────────────

-- SELECT : public (la page /sondages est accessible aux visiteurs sans compte)
create policy polls_select_public
  on public.polls for select
  to anon, authenticated
  using (true);

-- INSERT : admins uniquement, en leur nom
create policy polls_insert_admin
  on public.polls for insert
  to authenticated
  with check (
    created_by = auth.uid()
    and exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.is_admin = true
    )
  );

-- UPDATE : admins (clôture du sondage)
create policy polls_update_admin
  on public.polls for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.is_admin = true
    )
  );

-- DELETE : admins
create policy polls_delete_admin
  on public.polls for delete
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.is_admin = true
    )
  );

-- ─── RLS : poll_options ──────────────────────────────────────────────────────

-- SELECT : public (les choix sont affichés avec la question)
create policy poll_options_select_public
  on public.poll_options for select
  to anon, authenticated
  using (true);

-- INSERT : admins (les options sont créées avec le sondage)
create policy poll_options_insert_admin
  on public.poll_options for insert
  to authenticated
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.is_admin = true
    )
  );

-- UPDATE : admins
create policy poll_options_update_admin
  on public.poll_options for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.is_admin = true
    )
  );

-- DELETE : admins
create policy poll_options_delete_admin
  on public.poll_options for delete
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.is_admin = true
    )
  );

-- ─── RLS : poll_votes ────────────────────────────────────────────────────────
-- Chacun ne voit QUE ses propres votes : impossible de recompter les votes des
-- autres depuis le client avant la clôture (les résultats passent par la RPC).

-- SELECT : ses propres votes uniquement
create policy poll_votes_select_own
  on public.poll_votes for select
  to authenticated
  using (user_id = auth.uid());

-- INSERT : son propre vote, sur un sondage ouvert, avec une option du sondage
create policy poll_votes_insert_own
  on public.poll_votes for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.polls
      where polls.id = poll_votes.poll_id and polls.is_closed = false
    )
    and exists (
      select 1 from public.poll_options
      where poll_options.id = poll_votes.option_id
        and poll_options.poll_id = poll_votes.poll_id
    )
  );

-- UPDATE : modifier son vote tant que le sondage est ouvert
create policy poll_votes_update_own
  on public.poll_votes for update
  to authenticated
  using (
    user_id = auth.uid()
    and exists (
      select 1 from public.polls
      where polls.id = poll_votes.poll_id and polls.is_closed = false
    )
  )
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.poll_options
      where poll_options.id = poll_votes.option_id
        and poll_options.poll_id = poll_votes.poll_id
    )
  );

-- DELETE : retirer son vote tant que le sondage est ouvert
create policy poll_votes_delete_own
  on public.poll_votes for delete
  to authenticated
  using (
    user_id = auth.uid()
    and exists (
      select 1 from public.polls
      where polls.id = poll_votes.poll_id and polls.is_closed = false
    )
  );

-- ─── Résultats agrégés (security definer) ────────────────────────────────────
-- Ne renvoie les comptes que si le sondage est clôturé, OU si le demandeur est
-- admin (pour le suivi en direct côté gestion). Sinon, renvoie un ensemble vide.
-- security definer → contourne la RLS de poll_votes pour agréger sans exposer le
-- détail des votes individuels.

create or replace function public.get_poll_results(p_poll_id uuid)
  returns table (option_id uuid, label text, votes bigint)
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_is_closed boolean;
  v_is_admin  boolean;
begin
  select is_closed into v_is_closed from public.polls where id = p_poll_id;
  if v_is_closed is null then
    return; -- sondage inexistant
  end if;

  select coalesce(bool_or(is_admin), false) into v_is_admin
    from public.profiles where id = auth.uid();

  if v_is_closed = false and v_is_admin = false then
    return; -- résultats masqués tant que le sondage est ouvert
  end if;

  return query
    select o.id, o.label, count(v.id)::bigint
    from public.poll_options o
    left join public.poll_votes v on v.option_id = o.id
    where o.poll_id = p_poll_id
    group by o.id, o.label, o.position
    order by o.position;
end;
$$;

grant execute on function public.get_poll_results(uuid) to anon, authenticated;
