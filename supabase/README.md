# Supabase — Migrations

Ce dossier contient les migrations SQL appliquées à la base Supabase du projet.

## Workflow

Pas d'outillage automatisé pour l'instant. Les migrations sont **appliquées manuellement** via le SQL Editor du dashboard Supabase :

1. Dashboard Supabase → projet `siteaegp` → **SQL Editor**
2. Ouvrir le fichier `NNNN_xxx.sql` du repo, copier son contenu
3. Coller dans le SQL Editor et cliquer **Run**
4. Vérifier l'absence d'erreur dans le panneau de résultats

⚠️ **Les migrations ne sont pas idempotentes** : à appliquer **une seule fois**, en ordre séquentiel.

## Convention de nommage

```
NNNN_description_courte.sql
```

- `NNNN` : numéro séquentiel sur 4 chiffres (`0001`, `0002`, ...)
- `description_courte` : nom de l'objet principal ou de la feature, en snake_case

## Ordre d'application

Les migrations doivent être appliquées **dans l'ordre numérique**, car certaines dépendent des précédentes (clés étrangères, policies RLS qui référencent d'autres tables).

| Fichier | Contenu | Dépendances |
|---|---|---|
| `0001_profiles.sql` | Table `profiles` + trigger `on_auth_user_created` + RLS | — |
| `0002_ideas.sql` | Type `idea_status` + table `ideas` + 3 policies RLS | `0001_profiles.sql` (RLS référence `profiles`) |

## Après application de `0001_profiles.sql`

Le trigger crée les profils automatiquement à l'inscription. Pour tester les fonctionnalités admin (boîte à idées admin par exemple), il faut **se promouvoir membre BDE manuellement** :

```sql
update public.profiles
set is_bde_member = true
where id = '<ton-uuid>';
```

L'UUID se trouve dans Dashboard → Authentication → Users → ton compte (colonne `UID`).

## Rollback

Pas de rollback automatique. En cas de problème :
- Ouvrir le SQL Editor
- Écrire manuellement les `drop` correspondants
- Réappliquer la migration corrigée

Pour cette raison, **tester en local** ou sur une base de dev avant production quand on en aura une.

## Pourquoi pas la Supabase CLI ?

Décision session 10 : on reste au manuel pour éviter le setup CLI (lien projet, service role key dans l'env, etc.). À reconsidérer quand le rythme de migrations augmentera ou qu'on aura un environnement de staging.
