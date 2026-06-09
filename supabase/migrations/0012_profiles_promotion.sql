-- 0012_profiles_promotion.sql
-- Ajoute la promotion (L3/M1/M2) aux profils, alimentée par l'import des étudiants.
-- Sert à supprimer les diplômés en fin d'année (suppression par promotion côté /admin)
-- et à faire monter les niveaux d'une année sur l'autre (ré-import qui met à jour).

alter table public.profiles
  add column promotion text
  check (promotion is null or promotion in ('L3', 'M1', 'M2'));

-- Le trigger de création de profil copie désormais aussi la promotion depuis les
-- métadonnées d'invitation (`data.promotion` passé à /auth/v1/invite → raw_user_meta_data).
-- Le backend ne transmet `promotion` que si la valeur est valide → la contrainte CHECK
-- ne peut pas faire échouer la création de compte.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, promotion)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'promotion'
  );
  return new;
end;
$$;
