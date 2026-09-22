-- 0017_news_multiple_links.sql
-- Remplace le lien unique d'une actualité (link_url/link_label) par une
-- liste de liens (jusqu'à 5), chacun avec son propre texte de bouton.
-- Prérequis : 0011_news_link_label.sql doit être appliqué.

alter table public.news
  add column links jsonb not null default '[]'::jsonb
    check (
      jsonb_typeof(links) = 'array'
      and jsonb_array_length(links) <= 5
    );

-- Reprise des liens existants (une actu avait au plus un lien).
update public.news
set links = case
  when link_url is not null then
    jsonb_build_array(jsonb_build_object('url', link_url, 'label', link_label))
  else '[]'::jsonb
end;

alter table public.news
  drop column link_url,
  drop column link_label;
