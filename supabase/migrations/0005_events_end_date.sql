-- 0005_events_end_date.sql
-- Ajoute une heure de fin (optionnelle) aux événements de l'agenda.
-- Prérequis : 0003_events.sql appliqué.
--
-- `end_date` est nullable : les événements existants (et ceux sans fin définie)
-- restent valides. La contrainte garantit, quand une fin est saisie, qu'elle est
-- postérieure au début (le front gère le cas « soirée » en basculant la fin au
-- lendemain avant l'insert, donc end_date > start_date reste vrai).

alter table public.events
  add column end_date timestamptz;

alter table public.events
  add constraint events_end_after_start
  check (end_date is null or end_date > start_date);
