-- 0007_ideas_delete_policy.sql
-- Permet aux membres BDE / admins de supprimer une idée (la 0002 n'avait pas de
-- policy DELETE → la suppression était bloquée par la RLS).
-- Prérequis : 0001_profiles.sql et 0002_ideas.sql appliqués.

create policy ideas_delete_bde
  on public.ideas for delete
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and (profiles.is_bde_member = true or profiles.is_admin = true)
    )
  );
