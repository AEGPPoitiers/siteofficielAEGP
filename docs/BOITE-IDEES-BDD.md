# Brief BDD — Boîte à idées

Document de spécification à destination de l'équipe back/BDD pour implémenter la **fonctionnalité Boîte à idées** côté Supabase (schéma + RLS).

> **Statut** : v1, prêt à implémenter.
> Dernière mise à jour : 2026-06-03.
> **Public** : équipe back/BDD.

---

## 1. Contexte fonctionnel

La Boîte à idées est une **boîte aux lettres privée** où les étudiants déposent des suggestions (événements, cafet, autres), et que seul le BDE consulte.

| Aspect | Décision |
|---|---|
| Soumission | Étudiants connectés uniquement |
| Auteur | Signé (l'identité est stockée et visible côté BDE) |
| Visibilité | Membres BDE uniquement |
| Champs | Titre + description |
| Statuts (gérés par le BDE) | `nouvelle` / `en_etude` / `realisee` / `refusee` |
| Côté étudiant | Aveugle (envoi, pas de retour visible) |

> Pour les détails, voir le récap session 10 dans la mémoire projet.

---

## 2. Architecture choisie

Le front parle **directement à Supabase** pour cette fonctionnalité — comme pour l'auth. **Pas de passage par FastAPI**, car il n'y a pas de logique métier serveur : juste une écriture (INSERT par l'étudiant) et une lecture/mise à jour (SELECT/UPDATE par le BDE), tout étant protégé par la **Row Level Security (RLS)** de Postgres.

```
[ Étudiant ] ──INSERT──┐
                       ├──> [ Supabase Postgres + RLS ]
[ Membre BDE ] ─SELECT─┤
              └─UPDATE─┘
```

**Conséquence** : aucun endpoint FastAPI à prévoir côté back pour cette feature. Le travail back/BDD = **schéma SQL + policies RLS**.

---

## 3. Schéma SQL attendu

### 3.1 Type énuméré pour le statut

```sql
create type idea_status as enum (
  'nouvelle',
  'en_etude',
  'realisee',
  'refusee'
);
```

> Choix d'un ENUM Postgres plutôt qu'un `text` + `check` : plus strict, plus rapide à indexer.
> Inconvénient : ajouter une valeur plus tard demande `alter type ... add value`. Acceptable vu que les 4 statuts sont stables.

### 3.2 Table `ideas`

```sql
create table ideas (
  id          uuid primary key default gen_random_uuid(),
  title       text not null check (char_length(title) between 1 and 200),
  description text not null check (char_length(description) between 1 and 5000),
  status      idea_status not null default 'nouvelle',
  created_by  uuid not null references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);

create index ideas_status_idx on ideas (status);
create index ideas_created_at_idx on ideas (created_at desc);
```

**Notes :**
- `created_by` pointe vers `auth.users(id)` **directement**, pas vers `profiles(id)` — ainsi la table peut être créée même si `profiles` n'existe pas encore. Le nom de l'étudiant sera récupéré par jointure plus tard.
- `on delete set null` : si un étudiant est supprimé du système, l'idée reste mais l'auteur devient anonyme. Alternative : `on delete cascade` (idée supprimée avec l'auteur). À discuter ; `set null` est plus prudent pour l'historique.
- `char_length` (vs `length`) pour compter les caractères Unicode correctement.
- Pas de `updated_at` en v1 : seul le statut bouge, et on s'en fiche de savoir quand exactement. À ajouter plus tard si besoin d'historique.

---

## 4. Row Level Security (RLS) — 3 policies

```sql
alter table ideas enable row level security;
```

### 4.1 INSERT — tout étudiant connecté peut déposer une idée en son nom

```sql
create policy ideas_insert_own
  on ideas for insert
  to authenticated
  with check (created_by = auth.uid());
```

> Garantit qu'un étudiant ne peut pas usurper l'identité d'un autre en mettant un `created_by` arbitraire.

### 4.2 SELECT — seuls les membres BDE voient les idées

```sql
create policy ideas_select_bde
  on ideas for select
  to authenticated
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
        and (profiles.is_bde_member = true or profiles.is_admin = true)
    )
  );
```

### 4.3 UPDATE — seuls les membres BDE peuvent changer le statut

```sql
create policy ideas_update_bde
  on ideas for update
  to authenticated
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
        and (profiles.is_bde_member = true or profiles.is_admin = true)
    )
  );
```

> **Limitation acceptée en v1** : cette policy autorise techniquement à modifier **n'importe quel champ** (titre, description, auteur), pas seulement le statut. C'est OK car seuls les membres BDE de confiance ont ce droit. Pour restreindre strictement au statut, il faudrait passer par une fonction RPC dédiée (à voir en v2 si besoin).

### 4.4 DELETE — non couvert en v1

Aucune policy DELETE n'est créée → personne ne peut supprimer une idée. C'est volontaire (traçabilité). Si nécessaire plus tard, ajouter une policy réservée aux admins.

---

## 5. Dépendance bloquante : la table `profiles`

⚠️ **Les policies SELECT et UPDATE ci-dessus dépendent d'une table `profiles` qui n'existe pas encore.**

Cette table est nécessaire à **trois fonctionnalités** du site (Boîte à idées, Tutorat, Agenda côté admin). C'est donc une brique fondatrice du schéma. Voici le **minimum requis** pour débloquer la Boîte à idées :

```sql
create table profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  full_name     text,
  is_bde_member boolean not null default false,
  is_admin      boolean not null default false,
  created_at    timestamptz not null default now()
);

alter table profiles enable row level security;

-- Tout utilisateur authentifié peut lire les profils (utile pour afficher des noms)
create policy profiles_select_authenticated
  on profiles for select
  to authenticated
  using (true);

-- Chacun peut mettre à jour son propre profil, MAIS pas les flags is_bde_member / is_admin
-- (à durcir : pour l'instant on n'expose pas l'UPDATE côté front, donc on peut différer)
```

**À enrichir librement par l'équipe** avec les champs métier (promo, filière, année, avatar, etc.) — ce schéma minimal n'est qu'un **plancher** pour débloquer la RLS. Ne pas hésiter à l'étendre dans le brouillon global de schéma.

### Création automatique du profil à l'inscription

Lorsqu'un étudiant active son compte (via le lien d'invitation Supabase), Postgres doit créer automatiquement la ligne correspondante dans `profiles`. Pattern recommandé :

```sql
create function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
```

> Le `full_name` peut venir des `raw_user_meta_data` Supabase, ou être laissé vide et complété par l'étudiant via une page profil plus tard.

---

## 6. Plan de travail suggéré

### Étape 1 — Créer `profiles` (prérequis)
- Créer la table + RLS + trigger d'auto-création
- Promouvoir manuellement un compte de test en `is_bde_member = true` via le dashboard Supabase pour pouvoir tester la suite

### Étape 2 — Créer `ideas`
- Créer le type ENUM + la table + les indexes
- Activer la RLS + ajouter les 3 policies

### Étape 3 — Tester depuis le dashboard
Avant que le front consomme :
1. Se connecter en tant qu'étudiant standard (non-BDE) → tenter un INSERT → doit réussir
2. Tenter un SELECT → doit échouer (RLS bloque)
3. Se connecter en tant que membre BDE → SELECT → doit retourner les idées
4. UPDATE du statut → doit réussir

> Le SQL Editor du dashboard Supabase permet d'exécuter des requêtes en simulant un rôle utilisateur via `set local role authenticated` + `set local request.jwt.claims = '{"sub": "<uuid>"}'`. À documenter si besoin pour l'équipe.

### Étape 4 — Communiquer au front
Une fois la table en place, le front pourra implémenter la fonctionnalité en parlant directement à Supabase (pattern déjà utilisé pour Auth). Aucun travail back/FastAPI à prévoir.

---

## 7. Récap des décisions ouvertes

| Question | Notre suggestion | Décision équipe |
|---|---|---|
| `on delete set null` ou `cascade` pour `created_by` ? | `set null` (préserve l'historique) | ☐ |
| Champs supplémentaires sur `profiles` ? | Au choix de l'équipe (promo, filière, année…) | ☐ |
| Source du `full_name` (auth metadata ou page profil) ? | Au choix | ☐ |

---

Voir aussi : [`CONTRAT-API.md`](./CONTRAT-API.md) pour l'architecture globale front ↔ back.
