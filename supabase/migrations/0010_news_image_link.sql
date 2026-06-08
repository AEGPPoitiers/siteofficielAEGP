-- 0010_news_image_link.sql
-- Ajoute une image de couverture et un lien optionnels aux actualités.
-- Prérequis : 0009_news.sql et 0001_profiles.sql doivent être appliqués.
--
-- Storage : bucket `news-images` public en lecture (les visuels d'actu sont
-- publics par nature), upload/suppression réservés aux membres BDE et admins,
-- sur le modèle du bucket `event-images` (0003_events.sql).

-- ============================================================
-- Colonnes image_url et link_url
-- ============================================================

alter table public.news
  add column image_url text
    check (image_url is null or char_length(image_url) <= 2000),
  add column link_url text
    check (link_url is null or char_length(link_url) <= 2000);

-- ============================================================
-- Storage : bucket news-images
-- ============================================================

insert into storage.buckets (id, name, public)
values ('news-images', 'news-images', true);

-- Public read sur les fichiers du bucket
create policy "news_images_public_read"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'news-images');

-- Upload réservé aux membres BDE
create policy "news_images_bde_upload"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'news-images'
    and exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and (profiles.is_bde_member = true or profiles.is_admin = true)
    )
  );

-- Suppression réservée aux membres BDE (cleanup quand une actu est supprimée
-- ou son image remplacée)
create policy "news_images_bde_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'news-images'
    and exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and (profiles.is_bde_member = true or profiles.is_admin = true)
    )
  );
