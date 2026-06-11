# Contexte projet pour une IA — Site AEGP

> **But de ce document.** Donner à un assistant IA (Claude Code ou autre) **tout le contexte nécessaire** pour travailler sur ce projet au même niveau de connaissance qu'un assistant qui le suit depuis le début : architecture, décisions actées **et leur pourquoi**, pièges déjà rencontrés, état de production, conventions de travail. À lire **en entier** avant d'agir.
>
> Pour la prise en main outils/humaine, voir plutôt [`GUIDE-ADMIN.md`](GUIDE-ADMIN.md). Ce document-ci suppose que tu lis et écris du code.

---

## 0. TL;DR

Site web du BDE **AEGP** (Association des Étudiant·e·s en Génie Physiologique, Université de Poitiers). **En production**, utilisé par ~250 étudiants. Stack : **React 19 + Vite** (front, Vercel) · **FastAPI** (back minimal, Render) · **Supabase** (PostgreSQL + Auth + Storage) · **Backblaze B2** (documents tutorat) · **Brevo** (emails).

Principe d'archi central : **le front parle directement à Supabase** (Auth + données via RLS + Storage images). Le backend FastAPI n'intervient **que** là où une clé secrète est requise : signer les URLs B2 du tutorat, et les opérations admin avec la `service_role`.

---

## 1. Conventions de travail (important)

- **Langue : français.** Réponses, commentaires, messages de commit, docs utilisateur en français. Le code (noms de variables/fonctions) reste en anglais selon l'usage.
- **Workflow git** : `main` est protégée → **toujours** une branche + PR. Merge en **squash**, puis suppression de la branche (locale + distante). Commits en [Conventional Commits](https://www.conventionalcommits.org/fr/v1.0.0/). Branches `feat/…`, `fix/…`, `refactor/…`, `docs/…`, `chore/…`.
- **Migrations SQL** : écrites dans `supabase/migrations/`, mais **appliquées à la main** dans le SQL Editor du dashboard Supabase. **Il n'y a qu'une seule base = la prod.** Une migration peut donc être partiellement appliquée selon l'environnement.
- **Pas de CLI Supabase** installée (choix assumé). L'IA fournit le SQL, un humain l'exécute.

---

## 2. Architecture détaillée

```
Navigateur ──┬─► Supabase (Auth, PostgREST + RLS, Storage images)   [la majorité des données]
             │
             └─► FastAPI / Render ─► Backblaze B2 (docs tutorat, bucket privé)
                                  └─► Supabase service_role (admin : import, suppression…)
```

### Frontend (`frontend/`)
- **React 19 + TypeScript + Vite + Tailwind v4 + React Router v7.**
- Libs notables : `@supabase/supabase-js`, `react-big-calendar` + `date-fns` (agenda), `lucide-react` (icônes).
- Auth & rôles : `contexts/AuthContext.tsx` (session) + hook `lib/useIsBdeMember.ts` qui expose `isAdmin`, `isBde`, `canEditTutorat` (admin **ou** `is_tutor`), `canEditNews` (admin **ou** `is_com`).
- Gardes de route : `ProtectedRoute` (connecté), `BdeProtectedRoute` (membre BDE/admin), `AdminProtectedRoute` (admin) — affichent un `AccessDenied` explicite si rôle insuffisant, redirigent vers `/login` si non connecté.
- Primitives UI réutilisables dans `components/ui/` (Button, Input, Textarea, FieldError, FormCard, ConfirmDialog). Accent visuel = **noir** (pas de couleur supplémentaire). Fond de page coloré par route (`Layout.getBgClass`).
- Structure et routes détaillées : [`frontend/README.md`](../frontend/README.md).

### Backend (`backend/`)
- **FastAPI**, déployé sur Render (free tier → cold start ~30–50 s après 15 min d'inactivité).
- `auth.py` : valide les JWT Supabase. **ES256 via JWKS** (clés asymétriques), repli HS256 legacy.
- `deps.py` : `require_bde_member` (= `is_admin`), `require_admin` (= `is_admin`), `require_tutorat_editor` (= `is_admin` ou `is_tutor`). Lookup sur `profiles` via PostgREST + `service_role`.
- `b2.py` : client boto3, signe les URLs B2 (upload/download/delete). `routers/tutorat.py` + `routers/admin.py`.
- Détail endpoints : [`backend/README.md`](../backend/README.md) et [`docs/CONTRAT-API.md`](CONTRAT-API.md).

### Données / Supabase
- Migrations `0001`→`0016` (liste commentée dans [`supabase/README.md`](../supabase/README.md)).
- **Sécurité = RLS** (Row Level Security) sur chaque table. Le front utilise la clé **anon** (publique, c'est normal et voulu) ; ce sont les policies qui protègent.
- Trigger `handle_new_user` : à l'inscription, copie `full_name` et `promotion` depuis les métadonnées du compte vers `profiles`.

---

## 3. Modèle de rôles (état actuel, post-migration 0016)

| Flag `profiles` | Périmètre |
|---|---|
| `is_admin` | tout le contenu BDE (agenda, idées, tutorat, actualités) **+** administration |
| `is_tutor` | tutorat uniquement |
| `is_com` | actualités uniquement |

> ⚠️ **`is_bde_member` n'existe plus.** Il a été **fusionné dans `is_admin`** (migration `0016`, en prod) : il était toujours testé en `is_bde_member OR is_admin` → redondant. **Décision actée : aucune promotion automatique de comptes** (un ancien « membre BDE sans admin » perd le droit d'écriture — assumé). Ne pas réintroduire ce flag.

Les actualités (`is_com`) sont gérées **100 % par RLS** (pas d'endpoint FastAPI). Le tutorat (`is_tutor`) passe par le backend (URLs B2).

---

## 4. État de la production (fonctionnalités livrées)

Tout ce qui suit est **en prod et fonctionnel** :

- **Auth** : invitation Supabase (1ᵉʳ accès → `/set-password`), puis login email+password. Reset par email. Registration fermée (seuls les emails pré-chargés s'activent).
- **Agenda** : calendrier (vues mois + semaine), événements avec image, couleur, lieu, heure de fin optionnelle, lien externe. CRUD réservé BDE/admin.
- **Boîte à idées** : soumission par les étudiants (nom de l'auteur affiché), modération côté BDE.
- **Tutorat** : taxonomie en arbre (promo → option → matière), documents sur **Backblaze B2** (URLs signées via backend), aperçu/téléchargement, vue admin pour gérer l'arbre et les fichiers. Rôle `is_tutor`.
- **Actualités** : articles avec image + lien + texte de lien, filtre **année → mois** (100 % front). Rôle `is_com`.
- **Sondages** : choix unique, création/clôture/suppression admin, vote modifiable tant qu'ouvert, **résultats visibles seulement à la clôture** (confidentialité garantie côté base, voir §6). Encart « Sondage en cours » sur l'accueil.
- **Accueil** : sondage en cours + actualités + menu cafétéria (image statique, accordéon repliable sur mobile).
- **Administration** (`/admin`) : gestion des rôles, **édition des comptes** (nom/promo/email avec révocation de session), **import CSV** des étudiants (invitations Brevo), suppression par promotion.

---

## 5. Infos d'environnement concrètes

| Élément | Valeur |
|---|---|
| Front prod (Vercel) | `https://siteofficiel-aegp.vercel.app` (projet Vercel nommé **`siteofficiel-aegp`**, root dir `frontend`) |
| Backend (Render) | `https://siteaegp-api.onrender.com` (root dir `backend`, `render.yaml`) |
| Supabase | projet `siteaegp`, URL `https://awvnqxpdebatcrqogsat.supabase.co` (URL + clé anon publiques par nature) |
| Backblaze B2 | bucket **privé** `siteaegp-tutorat`, région `eu-central-003`, endpoint `https://s3.eu-central-003.backblazeb2.com` |
| Brevo | expéditeur `contact.aegp@gmail.com` ; **login SMTP = `xxxxx@smtp-brevo.com`** (pas l'adresse Gmail) ; 300 mails/jour |
| Supabase Site URL | `https://siteofficiel-aegp.vercel.app/set-password` (un seul champ → pour tester en local, basculer temporairement ou passer `redirect_to` à la main) |
| OTP / liens d'invitation | *Email OTP Expiration* = **86400 s (24 h)**, déjà réglé (max autorisé par Supabase) |

> Les secrets (clés `service_role`, B2, SMTP) ne sont **pas** dans le repo. Ils vivent dans les dashboards (Render, Vercel, Supabase) et chez le·la référent·e du bureau.

---

## 6. Pièges connus (déjà rencontrés et résolus — ne pas refaire l'erreur)

### Supabase / base
- **RLS Storage DELETE** : `supabase.storage.from(b).remove([path])` fait un **SELECT interne** d'abord. Sans policy **SELECT** sur `storage.objects` pour ce bucket, la suppression échoue **silencieusement** (`{data: [], error: null}`). Il faut **3 policies** (SELECT + INSERT + DELETE). Détecter côté code : traiter `data.length === 0` comme une erreur.
- **JWT ES256/JWKS** : Supabase signe les access tokens en **ES256** (clés asymétriques), exposées sur `{SUPABASE_URL}/auth/v1/.well-known/jwks.json`. Un backend qui valide en HS256 legacy renvoie **401 « Invalid token »**. Utiliser `PyJWKClient`. (Bug dormant : agenda/idées passent en RLS direct, donc le 401 n'est apparu qu'au premier endpoint backend authentifié.)
- **Confidentialité des votes (sondages)** : `poll_votes` n'expose à chacun **que ses propres votes** (RLS `user_id = auth.uid()`) → impossible de recompter avant clôture depuis le navigateur. Les agrégats passent par une fonction `get_poll_results()` **security definer** qui ne renvoie les comptes **que si le sondage est clôturé** (ou si le demandeur est admin). Ne pas casser ce mécanisme en exposant un SELECT count direct.
- **Migrations destructives (drop colonne/table)** : **inverser l'ordre de déploiement habituel** → déployer **d'abord** le code qui ne référence plus l'objet, **puis** appliquer le SQL. Sinon l'ancien code casse le temps du redéploiement. (Les migrations additives, elles, peuvent aller dans n'importe quel ordre.)

### Git / GitHub
- **Squash-merge** : ne **plus pousser** sur une branche dont la PR a déjà été mergée en squash → le commit reste orphelin et crée des conflits sur la PR suivante (vécu plusieurs fois : #38/#39, #50/#51). Pour empiler une PR sur une autre déjà mergée, rebaser avec `git rebase --onto origin/main <ancien-base>`.
- **`gh pr edit` casse** sur ce repo (erreur « Projects classic » déprécié, exit 1). Contourner via l'API : `gh api -X PATCH repos/AEGPPoitiers/siteofficielAEGP/pulls/<n> -f title=… -f body=…`.

### Hébergement / emails
- **Render free tier** : cold start ~30–50 s après 15 min d'inactivité. Le tutorat masque ça par une **suppression optimiste** (le nettoyage B2 part sans `await`). Décision : **keep-warm abandonné** — ne pas re-proposer de ping cron spontanément.
- **Backblaze B2** : une clé applicative ne s'affiche **qu'une fois** (non récupérable). Pour configurer le **CORS** d'un bucket il faut la capability `writeBuckets` → **Master Application Key** (les clés du formulaire web ne l'ont pas). Script : `backend/scripts/set_b2_cors.py`. Format clé B2 ≈ 31 car. (souvent préfixe `K`), ce n'est PAS un UUID.
- **Brevo SMTP** : réécrit **tous les liens** via son tracker `*.sendibt3.com`. **Impossible à désactiver** (anti-fraude, volontaire). Le lien fonctionne malgré tout (redirige vers la vraie URL, token intact). Décision : **on garde Brevo**, on vit avec l'URL moche. Vraie solution un jour = domaine custom + SPF/DKIM.
- **DMARC** : envoyer « from » une adresse `@gmail.com` via relais Brevo peut tomber en spam → prévenir les étudiants ; solution propre = domaine custom.
- **OTP expiration** : un **seul réglage partagé** pour invitations / magic links / resets (max 24 h). Déjà à 86400 s. Filet si un lien expire : l'étudiant passe par « mot de passe oublié », ou on relance l'import (idempotent).

### Frontend / déploiement
- **`frontend/.env` est gitignoré** → invisible de Vercel. Les `VITE_*` doivent être définies dans Vercel Settings, et Vite les **fige au build** → **redéployer** après changement.
- **Fallback SPA** : `frontend/vercel.json` réécrit `/(.*)` → `/index.html` (corrige le 404 au refresh d'une route client). Conséquence inhérente : toutes les routes renvoient HTTP 200 ; la vraie 404 est gérée en UX par `pages/NotFound.tsx`.

---

## 7. Décisions produit/techniques actées (et pourquoi)

- **Auth email+password** (pas magic link permanent) : les boîtes mail étudiantes sont peu consultées. L'email ne sert qu'au 1ᵉʳ accès (invitation) et au reset.
- **Deux stockages** : Supabase Storage pour les images (légères), Backblaze B2 pour les documents tutorat (~10 Go ; le 1 Go gratuit Supabase serait saturé). B2 choisi plutôt que Cloudflare R2 (qui demandait une CB) et que Supabase Storage seul.
- **Backend FastAPI minimal, pas un proxy systématique** : on ne route via le backend que ce qui exige un secret. Tout le reste = Supabase direct + RLS. Garde le backend petit et le free tier Render suffisant.
- **Sondages retirés de la navbar** mais route `/sondages` conservée (archive + gestion admin) ; l'usage courant passe par l'encart d'accueil. Décision UX : éviter trop d'onglets.
- **Import annuel ré-exécutable** (scénario A) : à la rentrée on ré-importe la liste à jour ; un compte existant voit sa promotion **mise à jour** (montée L3→M1→M2) plutôt qu'ignoré. Mapping : **M2 = rentrée+1, M1 = rentrée+2, L3 = rentrée+3**.
- **Pas de keep-warm Render** (cf §6).

---

## 8. Comment reprendre le fil

1. Lire ce document + les 4 README (racine, `frontend/`, `backend/`, `supabase/`).
2. Regarder `git log --oneline -20` pour les derniers chantiers.
3. Vérifier l'état réel de la base si une fonctionnalité dépend d'une migration : les migrations étant appliquées à la main, **ne jamais supposer** qu'une migration listée dans `supabase/migrations/` est appliquée → confirmer (requête de contrôle ou demander à l'humain).
4. Avant un gros changement : présenter brièvement objectif + fichiers touchés + approche, faire valider, coder d'une traite, résumer. Demander un OK explicite avant `git push` / ouverture ou merge de PR.

---

*Document maintenu à la main. Quand l'architecture, les décisions ou les pièges évoluent, mettre ce fichier à jour dans la même PR que le changement.*
