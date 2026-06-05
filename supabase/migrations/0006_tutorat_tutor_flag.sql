-- 0006_tutorat_tutor_flag.sql
-- Rôle « tuteur » : un étudiant membre de l'équipe tutorat peut ÉDITER la section
-- tutorat (taxonomie + documents) — et UNIQUEMENT celle-ci (pas l'agenda ni la
-- boîte à idées, qui restent réservées au BDE/admin).
--
-- Prérequis : 0001_profiles.sql et 0004_tutorat.sql appliqués.
--
-- Le flag se gère à la main (Table Editor / SQL Supabase), comme is_bde_member.

alter table public.profiles
  add column is_tutor boolean not null default false;

-- ============================================================
-- Élargissement des policies tutorat : BDE/admin OU tuteur.
-- (Noms de policy conservés ; ils incluent désormais les tuteurs.)
-- ============================================================

-- tutorat_nodes
alter policy tutorat_nodes_insert_bde on public.tutorat_nodes
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and (profiles.is_bde_member or profiles.is_admin or profiles.is_tutor)
    )
  );

alter policy tutorat_nodes_update_bde on public.tutorat_nodes
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and (profiles.is_bde_member or profiles.is_admin or profiles.is_tutor)
    )
  );

alter policy tutorat_nodes_delete_bde on public.tutorat_nodes
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and (profiles.is_bde_member or profiles.is_admin or profiles.is_tutor)
    )
  );

-- tutorat_documents
alter policy tutorat_documents_insert_bde on public.tutorat_documents
  with check (
    uploaded_by = auth.uid()
    and exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and (profiles.is_bde_member or profiles.is_admin or profiles.is_tutor)
    )
  );

alter policy tutorat_documents_update_bde on public.tutorat_documents
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and (profiles.is_bde_member or profiles.is_admin or profiles.is_tutor)
    )
  );

alter policy tutorat_documents_delete_bde on public.tutorat_documents
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and (profiles.is_bde_member or profiles.is_admin or profiles.is_tutor)
    )
  );
