-- 0016_drop_is_bde_member.sql
-- Fusion des rôles : suppression du flag `is_bde_member`, redondant avec `is_admin`.
-- Désormais, seul un admin peut écrire le contenu réservé au BDE (agenda, boîte à
-- idées, tutorat, actualités). Les rôles étroits `is_tutor` (tutorat) et `is_com`
-- (actualités) sont conservés tels quels.
--
-- ⚠️ DÉCISION : aucune promotion de comptes. Un éventuel compte qui était
-- is_bde_member=true SANS être admin perd ses droits d'écriture. (Choix assumé.)
--
-- Prérequis : toutes les migrations 0001 → 0015 appliquées.
--
-- Ordre obligatoire : on réécrit d'ABORD chaque policy qui référence la colonne,
-- PUIS on supprime la colonne (sinon le DROP échoue pour dépendance).
--
-- Note : les noms de policy gardent leur suffixe `_bde` (purement historique),
-- comme l'avaient fait 0006 (tuteurs) et 0013 (com).

-- ============================================================
-- events (0003) → is_admin
-- ============================================================

alter policy events_insert_bde on public.events
  with check (
    created_by = auth.uid()
    and exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.is_admin
    )
  );

alter policy events_update_bde on public.events
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.is_admin
    )
  );

alter policy events_delete_bde on public.events
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.is_admin
    )
  );

-- Storage : bucket event-images (0003)
alter policy "event_images_bde_upload" on storage.objects
  with check (
    bucket_id = 'event-images'
    and exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.is_admin
    )
  );

alter policy "event_images_bde_delete" on storage.objects
  using (
    bucket_id = 'event-images'
    and exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.is_admin
    )
  );

-- ============================================================
-- ideas (0002 + 0007) → is_admin
-- ============================================================

alter policy ideas_select_bde on public.ideas
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.is_admin
    )
  );

alter policy ideas_update_bde on public.ideas
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.is_admin
    )
  );

alter policy ideas_delete_bde on public.ideas
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.is_admin
    )
  );

-- ============================================================
-- tutorat (0004 + 0006) → is_admin OR is_tutor
-- ============================================================

alter policy tutorat_nodes_insert_bde on public.tutorat_nodes
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and (profiles.is_admin or profiles.is_tutor)
    )
  );

alter policy tutorat_nodes_update_bde on public.tutorat_nodes
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and (profiles.is_admin or profiles.is_tutor)
    )
  );

alter policy tutorat_nodes_delete_bde on public.tutorat_nodes
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and (profiles.is_admin or profiles.is_tutor)
    )
  );

alter policy tutorat_documents_insert_bde on public.tutorat_documents
  with check (
    uploaded_by = auth.uid()
    and exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and (profiles.is_admin or profiles.is_tutor)
    )
  );

alter policy tutorat_documents_update_bde on public.tutorat_documents
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and (profiles.is_admin or profiles.is_tutor)
    )
  );

alter policy tutorat_documents_delete_bde on public.tutorat_documents
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and (profiles.is_admin or profiles.is_tutor)
    )
  );

-- ============================================================
-- news (0009 + 0013) → is_admin OR is_com
-- ============================================================

alter policy news_insert_bde on public.news
  with check (
    created_by = auth.uid()
    and exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and (profiles.is_admin or profiles.is_com)
    )
  );

alter policy news_update_bde on public.news
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and (profiles.is_admin or profiles.is_com)
    )
  );

alter policy news_delete_bde on public.news
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and (profiles.is_admin or profiles.is_com)
    )
  );

-- Storage : bucket news-images (0010 + 0013)
alter policy "news_images_bde_upload" on storage.objects
  with check (
    bucket_id = 'news-images'
    and exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and (profiles.is_admin or profiles.is_com)
    )
  );

alter policy "news_images_bde_delete" on storage.objects
  using (
    bucket_id = 'news-images'
    and exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and (profiles.is_admin or profiles.is_com)
    )
  );

-- ============================================================
-- Suppression de la colonne (plus aucune policy ne la référence)
-- ============================================================

alter table public.profiles drop column is_bde_member;
