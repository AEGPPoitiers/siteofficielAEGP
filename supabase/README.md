# Supabase — Migrations

Ce dossier contient les migrations SQL appliquées à la base Supabase du projet (tables, policies RLS, triggers, fonctions, buckets Storage).

## Workflow

Pas d'outillage automatisé pour l'instant. Les migrations sont **appliquées manuellement** via le SQL Editor du dashboard Supabase :

1. Dashboard Supabase → projet → **SQL Editor**
2. Ouvrir le fichier `NNNN_xxx.sql` du repo, copier son contenu
3. Coller dans le SQL Editor et cliquer **Run**
4. Vérifier l'absence d'erreur dans le panneau de résultats

> ⚠️ Il n'y a **qu'une seule base** (= la prod). Toute migration appliquée l'est directement en production.

⚠️ **Les migrations ne sont pas idempotentes** : à appliquer **une seule fois**, dans l'ordre numérique.

## Convention de nommage

```
NNNN_description_courte.sql
```

- `NNNN` : numéro séquentiel sur 4 chiffres (`0001`, `0002`, …)
- `description_courte` : objet principal ou feature, en snake_case

## Ordre d'application

À appliquer **dans l'ordre numérique** : beaucoup dépendent des précédentes (clés étrangères, policies qui référencent `profiles`).

| Fichier | Contenu |
|---|---|
| `0001_profiles.sql` | Table `profiles` + trigger `handle_new_user` (copie `full_name`, `promotion`…) + RLS |
| `0002_ideas.sql` | Type `idea_status` + table `ideas` (boîte à idées) + RLS |
| `0003_events.sql` | Table `events` + RLS (SELECT public, écriture BDE) + bucket Storage `event-images` + policies storage |
| `0004_tutorat.sql` | Tables `tutorat_nodes` (taxonomie arbre auto-référente) + `tutorat_documents` + RLS + seed squelette taxonomie |
| `0005_events_end_date.sql` | Colonne `events.end_date` (heure de fin optionnelle) |
| `0006_tutorat_tutor_flag.sql` | Flag `profiles.is_tutor` + élargissement des policies tutorat (édition par les tuteurs) |
| `0007_ideas_delete_policy.sql` | Policy de suppression des idées (BDE) |
| `0008_events_color.sql` | Colonne `events.color` |
| `0009_news.sql` | Table `news` (actualités) + RLS |
| `0010_news_image_link.sql` | Colonnes `news.image_url` + `link_url` + bucket Storage `news-images` |
| `0011_news_link_label.sql` | Colonne `news.link_label` (texte du bouton de lien) |
| `0012_profiles_promotion.sql` | Colonne `profiles.promotion` (`L3`/`M1`/`M2`) + mise à jour du trigger |
| `0013_profiles_com.sql` | Flag `profiles.is_com` + élargissement des policies actualités (édition par la com) |
| `0014_admin_revoke_user_sessions.sql` | RPC `admin_revoke_user_sessions` (révoque les sessions après changement d'email) |
| `0015_polls.sql` | Tables `polls` / `poll_options` / `poll_votes` + RLS + RPC `get_poll_results` (résultats masqués avant clôture) |
| `0016_drop_is_bde_member.sql` | **Migration destructive** : bascule 18 policies de `is_bde_member` vers `is_admin`, puis `drop column is_bde_member` |

## Rôles (flags sur `profiles`)

| Flag | Donne accès à |
|---|---|
| `is_admin` | tout le contenu BDE (agenda, idées, tutorat, actualités) **et** l'administration |
| `is_tutor` | édition du tutorat uniquement |
| `is_com` | édition des actualités uniquement |

> Le flag `is_bde_member` a été **supprimé** (migration `0016`) : il était toujours testé en `is_bde_member OR is_admin`, donc redondant. Désormais seul `is_admin` écrit le contenu BDE.

Pour te promouvoir admin manuellement (premier compte) :

```sql
update public.profiles set is_admin = true where id = '<ton-uuid>';
```

L'UUID se trouve dans Dashboard → Authentication → Users → ton compte (colonne `UID`).

## ⚠️ Migrations destructives (drop colonne/table)

Pour une migration qui **supprime** un objet référencé par le code (ex. `0016` qui retire `is_bde_member`), **inverser l'ordre habituel** :

1. **D'abord** déployer le code qui ne référence plus l'objet (il marche avec ou sans la colonne).
2. **Ensuite seulement** appliquer le SQL.

Faire l'inverse casse l'ancien code (qui lit encore la colonne) le temps du redéploiement. Les migrations **additives** (nouvelle colonne/table) suivent l'ordre inverse : SQL d'abord, ou peu importe.

## Piège RLS Storage

Pour qu'un objet d'un bucket soit **supprimable** par un rôle, il faut **3 policies** sur `storage.objects` : `SELECT` + `INSERT` + `DELETE`. Une policy `DELETE` seule ne suffit pas — `remove()` fait un SELECT interne, et sans policy SELECT l'objet est invisible → suppression silencieusement sans effet (`{ data: [], error: null }`).

## Rollback

Pas de rollback automatique. En cas de problème : écrire manuellement les `drop` correspondants dans le SQL Editor, puis réappliquer la migration corrigée. Tester le SQL avec soin **avant** de l'exécuter (rappel : une seule base, = la prod).

## Pourquoi pas la Supabase CLI ?

Choix assumé : on reste au manuel pour éviter le setup CLI (lien projet, `service_role` dans l'env, etc.). À reconsidérer si le rythme de migrations augmente ou si on ajoute un environnement de staging.
