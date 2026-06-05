-- 0008_events_color.sql
-- Couleur (optionnelle) d'un événement, choisie à la création (affichée dans
-- le calendrier de l'agenda). Stockée en hex (#RRGGBB) ; null = couleur par défaut.
-- Prérequis : 0003_events.sql appliqué.

alter table public.events
  add column color text
  check (color is null or color ~ '^#[0-9a-fA-F]{6}$');
