-- 0004_tutorat.sql
-- Tutorat : partage de documents de cours.
-- Prérequis : 0001_profiles.sql doit être appliqué (les policies BDE en dépendent).
--
-- Modèle :
--   * `tutorat_nodes` : taxonomie en ARBRE (auto-référente) à profondeur variable.
--       - L3      = Promo → Matière           (parent_id null → promo, matière sous la promo)
--       - M1 / M2 = Promo → Option → Matière   (l'option n'existe qu'à partir du M1)
--     kind ∈ ('promo','option','matiere'). Règles de profondeur validées côté UI
--     (une FK ne peut pas garantir le kind du parent — taxonomie gérée par les BDE de confiance).
--   * `tutorat_documents` : un document rattaché à un node de kind='matiere' (validé côté UI).
--     Le fichier lui-même vit dans Backblaze B2 (bucket privé) ; seule la `file_key`
--     (clé de l'objet B2, générée côté backend) est stockée ici. Les URLs signées
--     d'upload/download sont fournies par le backend FastAPI.
--
-- Accès : SELECT réservé aux utilisateurs authentifiés (étudiants connectés),
-- INSERT/UPDATE/DELETE réservés aux membres BDE et admins.

-- ============================================================
-- Table tutorat_nodes (taxonomie)
-- ============================================================

create table public.tutorat_nodes (
  id         uuid primary key default gen_random_uuid(),
  parent_id  uuid references public.tutorat_nodes(id) on delete cascade,  -- null = racine (promo)
  name       text not null check (char_length(name) between 1 and 120),
  kind       text not null check (kind in ('promo', 'option', 'matiere')),
  position   int  not null default 0,
  created_at timestamptz not null default now(),
  -- garde-fou anti-auto-référence (ne couvre pas les cycles longs : le re-parentage
  -- n'est volontairement pas exposé dans l'UI admin en v1)
  check (parent_id is null or parent_id <> id)
);

create index tutorat_nodes_parent_idx on public.tutorat_nodes (parent_id);

-- Unicité des frères (même parent + même kind + même nom interdit).
-- `nulls not distinct` (Postgres 15+) pour couvrir aussi les racines (parent_id null).
create unique index tutorat_nodes_sibling_uniq
  on public.tutorat_nodes (parent_id, kind, name) nulls not distinct;

alter table public.tutorat_nodes enable row level security;

-- SELECT : tout utilisateur authentifié (étudiants connectés)
create policy tutorat_nodes_select_authenticated
  on public.tutorat_nodes for select
  to authenticated
  using (true);

-- INSERT : membres BDE
create policy tutorat_nodes_insert_bde
  on public.tutorat_nodes for insert
  to authenticated
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and (profiles.is_bde_member = true or profiles.is_admin = true)
    )
  );

-- UPDATE : membres BDE
create policy tutorat_nodes_update_bde
  on public.tutorat_nodes for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and (profiles.is_bde_member = true or profiles.is_admin = true)
    )
  );

-- DELETE : membres BDE
create policy tutorat_nodes_delete_bde
  on public.tutorat_nodes for delete
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and (profiles.is_bde_member = true or profiles.is_admin = true)
    )
  );

-- ============================================================
-- Table tutorat_documents
-- ============================================================

create table public.tutorat_documents (
  id           uuid primary key default gen_random_uuid(),
  node_id      uuid not null references public.tutorat_nodes(id) on delete cascade,  -- doit pointer un node kind=matiere (validé côté UI)
  title        text not null check (char_length(title) between 1 and 200),
  description  text check (description is null or char_length(description) <= 5000),
  doc_type     text not null check (doc_type in ('cm', 'td', 'tp', 'examen')),
  file_key     text not null,        -- clé de l'objet dans le bucket B2 (générée côté backend)
  file_name    text not null,        -- nom de fichier original (pour le téléchargement)
  file_size    bigint,
  content_type text,
  uploaded_by  uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now()
);

create index tutorat_documents_node_idx on public.tutorat_documents (node_id);

alter table public.tutorat_documents enable row level security;

-- SELECT : tout utilisateur authentifié
create policy tutorat_documents_select_authenticated
  on public.tutorat_documents for select
  to authenticated
  using (true);

-- INSERT : membres BDE, en leur nom
create policy tutorat_documents_insert_bde
  on public.tutorat_documents for insert
  to authenticated
  with check (
    uploaded_by = auth.uid()
    and exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and (profiles.is_bde_member = true or profiles.is_admin = true)
    )
  );

-- UPDATE : membres BDE
create policy tutorat_documents_update_bde
  on public.tutorat_documents for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and (profiles.is_bde_member = true or profiles.is_admin = true)
    )
  );

-- DELETE : membres BDE
create policy tutorat_documents_delete_bde
  on public.tutorat_documents for delete
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and (profiles.is_bde_member = true or profiles.is_admin = true)
    )
  );

-- ============================================================
-- Seed : squelette de taxonomie
-- (matières ajoutées ensuite via l'UI admin)
-- ============================================================

-- Promos
insert into public.tutorat_nodes (parent_id, name, kind, position) values
  (null, 'L3', 'promo', 1),
  (null, 'M1', 'promo', 2),
  (null, 'M2', 'promo', 3);

-- Options : uniquement sous M1 et M2 (pas en L3)
insert into public.tutorat_nodes (parent_id, name, kind, position)
select promo.id, opt.name, 'option', opt.position
from public.tutorat_nodes promo
cross join (values
  ('Physiologie', 1),
  ('Biotechnologies', 2),
  ('Imagerie', 3)
) as opt(name, position)
where promo.kind = 'promo'
  and promo.name in ('M1', 'M2');
