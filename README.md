# LoraOne — Plateforme de formations en ligne

Plateforme de formation B2C : l'apprenant s'inscrit directement aux cours,
l'équipe interne gère le catalogue et suit la progression. Cours riches
(vidéo, images, quiz), sessions présentielles et portail apprenant immersif.

**Stack** : Node.js 24 · Express 5 · TypeScript · Prisma · PostgreSQL ou MySQL · Next.js 16 · React 19 · Tailwind CSS 4

## Structure

```
lite-udemy/
├── backend/            API Express + Prisma (port 4100)
│   ├── prisma/         schéma + migrations + seed démo
│   └── src/routes/     auth, team, learners, formations, quiz, sessions,
│                       catalogue, enrollments, me (portail), stats, uploads
├── frontend/           Next.js App Router (port 3000)
│   └── src/            espace équipe + portail apprenant + middleware
├── tests/              tests end-to-end API (python3)
├── dev.sh              démarre backend + frontend
└── watchdog.sh         relance auto des serveurs
```

## Démarrage

```bash
# 1. Base de données
cd backend
npx prisma migrate dev       # crée les tables
npx tsx prisma/seed.ts       # données de démonstration

# 2. Backend (port 4100)
npm run dev

# 3. Frontend (port 3000) — dans un autre terminal
cd ../frontend
npm run dev
```

Variables d'environnement : voir `backend/.env` (`DATABASE_URL`, `JWT_SECRET`, `PORT`) et
`frontend/.env.local` (`NEXT_PUBLIC_API_URL`).

### Variante MySQL

L'API passe par Prisma : elle fonctionne aussi bien sur PostgreSQL que MySQL. Sur une
machine où seule MySQL (ou MariaDB ≥ 10.5) est disponible :

```sql
-- 1. Base et utilisateur (client mysql, en root)
CREATE DATABASE liteudemy CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'liteudemy'@'localhost' IDENTIFIED BY 'motdepasse';
GRANT ALL PRIVILEGES ON liteudemy.* TO 'liteudemy'@'localhost';
```

2. Dans `backend/prisma/schema.prisma`, remplacer `provider = "postgresql"` par
   `provider = "mysql"` (Prisma ne lit pas le provider via une variable d'environnement :
   ce réglage reste propre à chaque machine).
3. Dans `backend/.env`, pointer `DATABASE_URL` sur MySQL (modèle : `backend/.env.mysql.example`).
4. Créer les tables et les données de démo — le dossier `prisma/migrations` du dépôt est au
   format PostgreSQL, on synchronise donc directement le schéma :
   ```bash
   npx prisma db push       # crée les tables depuis schema.prisma
   npx tsx prisma/seed.ts   # données de démonstration
   ```

## Rôles

| Rôle | Périmètre |
|---|---|
| **Admin** | Tout le back-office + gestion de l'équipe (créer les comptes, changer les rôles) |
| **Gestionnaire** | Crée les formations, assigne les formateurs, publie, inscrit les apprenants, analytics |
| **Formateur** | Construit le contenu (sections, leçons, quiz, vidéos) et anime les sessions de **ses** formations |
| **Apprenant** | Portail : catalogue public, auto-inscription aux formations gratuites, progression, quiz |

Le flux : le gestionnaire crée la coquille de formation et assigne un formateur ;
le formateur construit le cours et son contenu ; le gestionnaire publie ;
l'apprenant s'inscrit (gratuit = auto-inscription, payant = inscription par
l'équipe en attendant le paiement en ligne).

## Fonctionnalités

### 🎓 Formations & pédagogie
- **Builder de cours avancé** : sections/leçons avec **blocs de contenu** (texte riche,
  images uploadées, code, encadrés) réordonnables — vidéo toujours en haut
- **Quiz** : QCM créés par le formateur, correction serveur, meilleur score conservé,
  statistiques de réussite
- **Streaming vidéo** protégé (HTTP Range, seek) : accessible seulement aux inscrits
- **Sessions présentielles** avec modalité par créneau (présentiel/visio), calendrier
  mensuel, inscription des participants et pointage des présences

### 👤 Portail apprenant
- Inscription libre, **catalogue public** (formations gratuites ou payantes, badge
  "✦ Nouveau"), auto-inscription aux formations gratuites
- Accueil **style Netflix** : hero immersif, rangées "Continuer / Nouveautés" avec
  couvertures générées, progression globale
- Lecteur avec reprise de position, complétion automatique à 92 %, quiz interactifs

### 📊 Espace équipe
- **Tableau de bord** : apprenants, inscriptions, engagement 30 j, sessions à venir
- **Progression** : kanban lecture seule (Non commencé / En cours / Terminé),
  une carte par inscription, filtrable par formation
- **Apprenants** : fiches détaillées (inscriptions, progression, quiz, sessions)
- **Analytics pédagogiques** : inscriptions par mois, top formations, complétion
  moyenne, scores aux quiz, auto-inscriptions vs inscriptions équipe
- **Équipe** (admin) : création de comptes, changement de rôles

### 🔐 Sécurité
- JWT httpOnly avec rôle embarqué revérifié en base à chaque requête
- Garde-fous par rôle côté API (403) et middleware serveur côté Next.js
- Périmètre formateur : seules les formations qui lui sont assignées
- Mots de passe bcrypt, isolation stricte des données entre apprenants

### 🌗 Divers
- Thème clair/sombre avec détection OS et persistance
- Mini Postman intégré (`/postman`) pour explorer l'API

## Tests

```bash
python3 tests/e2e_api.py     # flux complet multi-rôles
python3 tests/e2e_video.py   # upload + streaming + protection vidéo
```

## Comptes de démonstration (après seed)

| Rôle | Email | Mot de passe |
|---|---|---|
| Admin | `admin@liteudemy.local` | `admin123` |
| Gestionnaire | `gestion@liteudemy.local` | `gestion123` |
| Formateur | `formateur@liteudemy.local` | `formateur123` |
| Apprenants | `jean@example.fr`, `lea@example.fr`, `marie@example.fr` | `demo123` |
