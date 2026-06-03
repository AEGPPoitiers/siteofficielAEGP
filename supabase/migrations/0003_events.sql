-- 0003_events.sql
-- Table `events` : agenda des événements du BDE.
-- Prérequis : 0001_profiles.sql doit être appliqué (les policies BDE en dépendent).
--
-- Accès : SELECT public (page /agenda accessible aux visiteurs sans compte),
-- INSERT/UPDATE/DELETE réservés aux membres BDE et admins.
--
-- Storage : bucket `event-images` public en lecture (les affiches sont publiques
-- par nature), upload/suppression réservés aux membres BDE.

-- ============================================================
-- Table events
-- ============================================================

create table public.events (
  id            uuid primary key default gen_random_uuid(),
  title         text not null check (char_length(title) between 1 and 200),
  description   text check (description is null or char_length(description) <= 5000),
  start_date    timestamptz not null,
  location      text,
  image_url     text,
  external_link text,
  created_by    uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now()
);

create index events_start_date_idx on public.events (start_date);

alter table public.events enable row level security;

-- SELECT : public (visiteurs non connectés inclus)
create policy events_select_public
  on public.events for select
  to anon, authenticated
  using (true);

-- INSERT : membres BDE uniquement, en leur nom
create policy events_insert_bde
  on public.events for insert
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
create policy events_update_bde
  on public.events for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and (profiles.is_bde_member = true or profiles.is_admin = true)
    )
  );

-- DELETE : membres BDE
create policy events_delete_bde
  on public.events for delete
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and (profiles.is_bde_member = true or profiles.is_admin = true)
    )
  );

-- ============================================================
-- Storage : bucket event-images
-- ============================================================

insert into storage.buckets (id, name, public)
values ('event-images', 'event-images', true);

-- Public read sur les fichiers du bucket
create policy "event_images_public_read"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'event-images');

-- Upload réservé aux membres BDE
create policy "event_images_bde_upload"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'event-images'
    and exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and (profiles.is_bde_member = true or profiles.is_admin = true)
    )
  );

-- Suppression réservée aux membres BDE (utile pour cleanup quand un event est supprimé)
create policy "event_images_bde_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'event-images'
    and exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and (profiles.is_bde_member = true or profiles.is_admin = true)
    )
  );
