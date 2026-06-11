# Guide des admins — Site AEGP

Bienvenue. Ce document s'adresse aux **prochain·e·s admins** du site de l'AEGP. Il explique concrètement : à quoi sert chaque outil, comment l'architecture tient ensemble, comment installer son environnement, et comment faire tourner le site au quotidien (notamment à la rentrée).

> 🔗 **Site en production : https://siteofficiel-aegp.vercel.app**
> 📂 Code : https://github.com/AEGPPoitiers/siteofficielAEGP

---

## 1. Vue d'ensemble : comment le site est construit

Le site est composé de **briques séparées**, chacune avec un rôle précis et un hébergeur gratuit.

```
                 Navigateur (l'étudiant·e)
                         │
          ┌──────────────┴───────────────┐
          │                              │
   Frontend React (Vercel)         appels directs
   siteofficiel-aegp.vercel.app          │
          │                              ▼
          │                     Supabase (PostgreSQL + Auth + Storage)
          │                     - comptes, login, rôles
          │                     - agenda, idées, actus, sondages
          │                     - images (Storage)
          │                     - sécurité par "RLS" (règles SQL)
          │
          └──► Backend FastAPI (Render) ──► Backblaze B2
               siteaegp-api.onrender.com    - documents du tutorat
               - signe les liens B2         (gros fichiers, privés)
               - opérations admin
                 (import étudiants…)
```

**Idée clé à retenir :** le frontend parle **directement à Supabase** pour presque tout. Le backend FastAPI n'existe que pour les rares cas où une **clé secrète** est nécessaire et ne peut pas être mise dans le navigateur :
- signer les liens de téléchargement des **documents du tutorat** (stockés sur Backblaze B2, privé) ;
- les **opérations d'administration** (inviter 250 étudiants d'un coup, supprimer une promo…) qui utilisent la clé toute-puissante de Supabase.

### Pourquoi deux stockages ?

| Stockage | Pour quoi | Pourquoi |
|---|---|---|
| **Supabase Storage** | images d'événements et d'actualités (légers) | intégré, simple, 1 Go gratuit suffit |
| **Backblaze B2** | documents du tutorat (PDF, ~10 Go sur plusieurs années) | 10 Go gratuits, bien moins cher au-delà ; le 1 Go de Supabase serait vite saturé |

---

## 2. Les comptes en ligne

Tous créés avec l'adresse mail de l'AEGP. **Les identifiants sont détenus par le·la référent·e du bureau** (à transmettre à chaque passation, idéalement dans un gestionnaire de mots de passe).

| Service | Rôle | Plan | À surveiller |
|---|---|---|---|
| **GitHub** | héberge le code, collaboration via PR | Gratuit | ajouter les nouveaux admins comme *collaborateurs* du repo |
| **Supabase** | base de données + authentification + Storage images | Free | projet en pause après ~7 jours d'inactivité totale (relance auto au 1ᵉʳ accès) |
| **Vercel** | héberge le frontend en prod | Free (Hobby) | redéploie tout seul à chaque push sur `main` |
| **Render** | héberge le backend FastAPI | Free | s'endort après ~15 min d'inactivité → 1ᵉʳ appel lent (~30–50 s) |
| **Backblaze B2** | stocke les documents du tutorat | Free | 10 Go ; buckets **privés** uniquement (les publics sont payants) |
| **Brevo** | envoi des emails (invitations, resets) | Free | 300 emails/jour — couvre les ~250 étudiants en une fois |

---

## 3. Installer son environnement de dev

Guide pensé pour **Windows (avec WSL2)**, **macOS** et **Linux**.

> **Windows uniquement** : installer d'abord **WSL2** (Windows Subsystem for Linux) et travailler dedans → https://learn.microsoft.com/fr-fr/windows/wsl/install

### Outils nécessaires

| Outil | Pour quoi | Version |
|---|---|---|
| **Git** | versionner le code | dernière stable |
| **Node.js** | frontend React | **20 LTS** (via nvm) |
| **Python** | backend FastAPI | **3.14** (via pyenv) |
| **VS Code** | éditeur | dernière stable |

### Étape 0 — Vérifier ce qui est déjà là

```bash
git --version
node --version
python3 --version
```

Si une commande renvoie `command not found`, il faut l'installer.

### Étape 1 — Git

```bash
# Linux / WSL
sudo apt update && sudo apt install -y git
# macOS (avec Homebrew, sinon https://brew.sh)
brew install git
```

Configurer une fois par personne :

```bash
git config --global user.name "Ton nom"
git config --global user.email "ton.email@exemple.fr"
```

### Étape 2 — Node.js via nvm

nvm permet d'avoir plusieurs versions de Node et de basculer facilement (`nvm install 22` un jour si besoin).

```bash
# Installer nvm (Linux / macOS / WSL), puis fermer/rouvrir le terminal
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash

nvm install 20
nvm use 20
nvm alias default 20
node --version   # v20.x.x
```

### Étape 3 — Python 3.14 via pyenv

```bash
# Linux / WSL — dépendances de compilation
sudo apt install -y make build-essential libssl-dev zlib1g-dev libbz2-dev \
  libreadline-dev libsqlite3-dev wget curl llvm libncursesw5-dev xz-utils \
  tk-dev libxml2-dev libxmlsec1-dev libffi-dev liblzma-dev
curl https://pyenv.run | bash

# macOS
brew install pyenv
```

Ajouter pyenv au shell (`~/.bashrc` ou `~/.zshrc`), puis rouvrir le terminal :

```bash
export PYENV_ROOT="$HOME/.pyenv"
[[ -d $PYENV_ROOT/bin ]] && export PATH="$PYENV_ROOT/bin:$PATH"
eval "$(pyenv init - bash)"   # remplacer "bash" par "zsh" sur macOS
```

```bash
pyenv install 3.14
pyenv global 3.14
python3 --version   # Python 3.14.x
```

**Règle d'or Python : ne JAMAIS faire `pip install` sur le Python global.** Toujours un environnement virtuel par projet (voir [`backend/README.md`](../backend/README.md)) :

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate     # le prompt affiche (.venv) quand c'est actif
pip install -r requirements.txt
```

### Étape 4 — VS Code

Téléchargement : https://code.visualstudio.com/ — extensions recommandées :

- **ES7+ React/Redux/React-Native snippets** (frontend)
- **Tailwind CSS IntelliSense** (frontend)
- **Python** + **Pylance** (backend)
- **GitLens** (gestion visuelle de git, conflits)
- **Prettier** (formatage)
- **WSL** (Windows uniquement, pour ouvrir VS Code dans WSL)

---

## 4. Récupérer le projet et workflow git

Chaque admin a un **compte GitHub personnel** ; les admins précédents l'ajoutent comme **collaborateur** du repo.

### Cloner (première fois)

```bash
git clone https://github.com/AEGPPoitiers/siteofficielAEGP.git
cd siteofficielAEGP
```

Structure :

```
frontend/   → application React + Vite        (voir frontend/README.md)
backend/    → API FastAPI                      (voir backend/README.md)
supabase/   → migrations SQL de la base        (voir supabase/README.md)
docs/       → documentation (dont ce guide)
```

### La règle d'or git : jamais directement sur `main`

`main` est **protégée**. Pour toute modif, on crée une branche, on pousse, on ouvre une **Pull Request (PR)**, on fait relire, on merge.

```bash
git checkout -b feat/ma-fonctionnalite   # créer + basculer dessus
# ... modifications + commits ...
git add .
git commit -m "feat: description claire de la modif"
git push -u origin feat/ma-fonctionnalite   # 1ᵉʳ push
```

Sur GitHub : **Compare & pull request** → titre clair + description (quoi + pourquoi) → relecture → **Merge** (en *squash*) → **Delete branch**.

Puis nettoyer en local :

```bash
git checkout main
git pull
git branch -d feat/ma-fonctionnalite
```

**Conventions :**
- **Commits** : [Conventional Commits](https://www.conventionalcommits.org/fr/v1.0.0/) — `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`
- **Branches** : `feat/...`, `fix/...`, `refactor/...`, `docs/...`, `chore/...`

### Gérer un conflit

Quand `git pull` ou un merge produit un conflit, Git marque les fichiers :

```
<<<<<<< HEAD
ma version locale
=======
version distante
>>>>>>> origin/main
```

Ouvrir le fichier, garder la bonne version (ou combiner), supprimer les marqueurs `<<<`, `===`, `>>>`, puis `git add <fichier>` et `git commit`. L'extension **GitLens** propose une interface visuelle (boutons « Accept Current / Incoming / Both »). Pour tout annuler : `git merge --abort`.

---

## 5. Variables d'environnement (secrets)

**Principe : les secrets (clés API, mots de passe, tokens) ne sont JAMAIS commités dans Git.** Chaque projet a un fichier `.env` (listé dans `.gitignore`), rempli à partir du `.env.example` fourni.

| Projet | Fichier | Contient |
|---|---|---|
| frontend | `frontend/.env` | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (clé **publique**), `VITE_API_URL` |
| backend | `backend/.env` | clés Supabase `service_role`, secrets Backblaze B2 (voir `.env.example`) |

> ⚠️ **En production, le `.env` local n'est PAS utilisé** : il est gitignoré, donc invisible des hébergeurs. Les variables sont à renseigner **dans les dashboards** :
> - **Vercel** → Settings → Environment Variables (les `VITE_*`)
> - **Render** → Environment (les secrets backend)
>
> Vite « fige » les `VITE_*` au moment du build : après avoir changé une variable sur Vercel, il faut **redéployer**.

---

## 6. Base de données et migrations

Toutes les évolutions de la base (tables, sécurité, fonctions) sont écrites en fichiers SQL dans `supabase/migrations/` (`0001_…` à `0016_…`).

**Il n'y a pas d'outil automatique : les migrations sont appliquées à la main** dans le SQL Editor du dashboard Supabase, dans l'ordre numérique. Détail complet, liste des migrations et pièges : [`supabase/README.md`](../supabase/README.md).

> ⚠️ Il n'y a **qu'une seule base** = la production. Une migration mal écrite touche directement le site live. Lire le SQL avant de cliquer **Run**.

### Les rôles (qui peut faire quoi)

Trois drapeaux sur la table `profiles` :

| Rôle | Donne accès à |
|---|---|
| `is_admin` | tout le contenu BDE (agenda, idées, tutorat, actualités) **+** l'administration (`/admin`) |
| `is_tutor` | édition du **tutorat** uniquement |
| `is_com` | édition des **actualités** uniquement |

On règle ces rôles depuis la page **`/admin`** du site (réservée aux admins). Pour le **tout premier** admin, se promouvoir en SQL :

```sql
update public.profiles set is_admin = true where id = '<ton-uuid>';
```

(l'UUID est dans Dashboard Supabase → Authentication → Users → colonne `UID`)

---

## 7. Déploiement

- **Frontend (Vercel)** : automatique à chaque push sur `main`. Rien à faire manuellement. Root directory = `frontend`.
- **Backend (Render)** : automatique aussi (déploiement sur push), root directory = `backend`, configuré via `backend/render.yaml`.

> Une migration SQL n'est **jamais** déployée automatiquement → c'est toujours un copier-coller manuel dans Supabase (voir §6).

---

## 8. Opérations de rentrée (le moment important de l'année)

C'est le gros chantier annuel : créer les comptes des nouveaux étudiants et gérer les montées de promo. Tout se passe sur la page **`/admin`** du site.

### a. Préparer l'envoi des emails

Les invitations partent via **Brevo** (SMTP). Vérifier en amont :
- expéditeur `contact.aegp@gmail.com` vérifié dans Brevo ;
- identifiants SMTP collés dans Supabase → Authentication → Emails → SMTP ;
- **validité des liens d'invitation** réglée à 24 h : Supabase → Authentication → Providers → Email → *Email OTP Expiration* = `86400`.

> Le **login SMTP Brevo n'est PAS l'adresse Gmail** mais un identifiant dédié `xxxxxxx@smtp-brevo.com`, et le mot de passe est une « SMTP key » générée dans Brevo (onglet SMTP & API). C'est l'erreur classique au premier envoi.

### b. Importer les étudiants (CSV)

Page **`/admin/import`** → coller/uploader le CSV de la fac → un **aperçu** s'affiche avant tout envoi. Le parser reconnaît les colonnes par intitulé (email, Nom, Prénom, « Promotion d'appartenance »).

La **promotion** (L3 / M1 / M2) est calculée à partir de l'année de diplôme et de l'**« Année de la rentrée »** saisie sur la page :
- **M2 = rentrée + 1**, **M1 = rentrée + 2**, **L3 = rentrée + 3**.

Les promos hors de cette fenêtre (déjà diplômés, L1/L2) sont **exclues** automatiquement. L'import est **ré-exécutable** sans créer de doublons (un étudiant déjà inscrit voit juste sa promotion mise à jour).

### c. Faire le ménage des diplômés

En fin d'année, sur `/admin` : filtrer la promo sortante (M2) → bouton **« Supprimer la promotion »** (les comptes admin sont protégés).

### d. Emails personnalisés

Les templates (invitation + reset mot de passe) sont versionnés dans [`docs/email-templates/`](email-templates/) **mais ne sont pas déployés automatiquement** : toute modif doit être recopiée à la main dans Supabase → Authentication → Emails → Templates.

---

## 9. Pièges connus (gagner du temps)

- **1ᵉʳ chargement lent** d'un upload/téléchargement tutorat = le backend Render qui se réveille (~30–50 s). Normal, ce n'est pas un bug.
- **Lien d'invitation moche** (`sendibt3.com…`) = le tracking de Brevo réécrit les liens. **Impossible à désactiver**, mais le lien **fonctionne**. On vit avec.
- **401 sur une action admin** = ta session a expiré → se déconnecter/reconnecter. (Un **403** = pas le bon rôle, c'est différent.)
- **Une modif d'env var Vercel ne prend pas** = il faut **redéployer** (Vite fige les variables au build).

---

## 10. Où trouver quoi

| Besoin | Document |
|---|---|
| Vue d'ensemble rapide | [`README.md`](../README.md) |
| Lancer / structurer le **frontend** | [`frontend/README.md`](../frontend/README.md) |
| Lancer / déployer le **backend** | [`backend/README.md`](../backend/README.md) |
| **Migrations** SQL et rôles | [`supabase/README.md`](../supabase/README.md) |
| **Contrat d'API** (conventions backend) | [`docs/CONTRAT-API.md`](CONTRAT-API.md) |
| **Templates email** | [`docs/email-templates/`](email-templates/) |
| Contexte complet pour une **IA** assistante | [`docs/CONTEXTE-IA.md`](CONTEXTE-IA.md) |

**Communication de l'équipe** : serveur Discord de l'AEGP.

Bon courage, et bienvenue dans l'équipe technique de l'AEGP 🧪
