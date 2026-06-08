-- 0011_news_link_label.sql
-- Texte personnalisable pour le lien d'une actualité (ex : « S'inscrire »,
-- « Voir les photos »). Si null, l'affichage retombe sur « En savoir plus ».
-- Prérequis : 0010_news_image_link.sql doit être appliqué.

alter table public.news
  add column link_label text
    check (link_label is null or char_length(link_label) <= 80);
