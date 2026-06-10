-- 0013_profiles_com.sql
-- Rôle « com » : un membre du BDE chargé de la communication peut GÉRER les
-- actualités (création/édition/suppression + images) — et UNIQUEMENT cela (pas
-- l'agenda, ni la boîte à idées, ni le tutorat, qui restent réservés au BDE/admin).
--
-- Pendant côté actualités du rôle « tuteur » côté tutorat (cf 0006_tutorat_tutor_flag.sql).
--
-- Prérequis : 0001_profiles.sql, 0009_news.sql et 0010_news_image_link.sql appliqués.
--
-- Le flag se gère depuis l'admin (page « membres ») ou à la main (SQL Supabase),
-- comme is_bde_member et is_tutor.

alter table public.profiles
  add column is_com boolean not null default false;

-- ============================================================
-- Élargissement des policies news : BDE/admin OU com.
-- (Noms de policy conservés ; ils incluent désormais les membres com.)
-- ============================================================

alter policy news_insert_bde on public.news
  with check (
    created_by = auth.uid()
    and exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and (profiles.is_bde_member or profiles.is_admin or profiles.is_com)
    )
  );

alter policy news_update_bde on public.news
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and (profiles.is_bde_member or profiles.is_admin or profiles.is_com)
    )
  );

alter policy news_delete_bde on public.news
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and (profiles.is_bde_member or profiles.is_admin or profiles.is_com)
    )
  );

-- ============================================================
-- Élargissement des policies storage news-images : BDE/admin OU com.
-- ============================================================

alter policy "news_images_bde_upload" on storage.objects
  with check (
    bucket_id = 'news-images'
    and exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and (profiles.is_bde_member or profiles.is_admin or profiles.is_com)
    )
  );

alter policy "news_images_bde_delete" on storage.objects
  using (
    bucket_id = 'news-images'
    and exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and (profiles.is_bde_member or profiles.is_admin or profiles.is_com)
    )
  );
