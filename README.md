# Lite Academy — CRM & Gestion des Formations

CRM haute technologie pour organisme de formation : gestion commerciale (pipeline kanban,
analytics), catalogue de formations en ligne/présentiel, cours riches (vidéo, images, quiz)
et portail apprenant immersif.

**Stack** : Node.js 24 · Express 5 · TypeScript · Prisma · PostgreSQL · Next.js 16 · React 19 · Tailwind CSS 4

## Structure

```
lite-udemy/
├── backend/            API Express + Prisma (port 4100)
│   ├── prisma/         schéma + migrations + seed démo
│   └── src/routes/     auth, clients, formations, deals, quiz, sessions,
│                       catalogue, me (portail), stats, uploads (vidéo/images)
├── frontend/           Next.js App Router (port 3000)
│   └── src/            back-office staff + portail apprenant + middleware
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

## Fonctionnalités

### 📈 CRM & commercial
- **Pipeline kanban** : opportunités avec glisser-déposer (Contact → Qualifié → Devis →
  Négociation → Gagné/Perdu), CA prévisionnel par étape
- **Analytics** : CA mensuel (graphiques SVG maison), entonnoir de conversion,
  top formations, scores moyens aux quiz
- **CRM clients** : fiches entreprise/particulier, statuts (lead → client), contacts
  apprenants, journal d'interactions (appels, emails, RDV)

### 🎓 Formations & pédagogie
- **Builder de cours avancé** : sections/leçons avec **blocs de contenu** (texte riche,
  images uploadées, code, encadrés) réordonnables — vidéo toujours en haut
- **Quiz** : QCM créés par le staff, correction serveur, meilleur score conservé,
  statistiques de réussite
- **Streaming vidéo** protégé (HTTP Range, seek) : accessible seulement aux inscrits
- **Sessions présentielles** avec modalité par créneau (présentiel/visio), calendrier
  mensuel et détection de conflits formateur

### 👤 Portail apprenant
- Inscription libre, **catalogue public** (formations gratuites ou payantes, badge
  "✦ Nouveau"), auto-inscription aux formations gratuites
- Accueil **style Netflix** : hero immersif, rangées "Continuer / Nouveautés" avec
  couvertures générées, progression globale
- Lecteur avec reprise de position, complétion automatique à 92 %, quiz interactifs

### 🔐 Sécurité
- JWT httpOnly avec rôle embarqué revérifié en base à chaque requête
- Garde-fous de rôle côté API (403) et middleware serveur côté Next.js
- Mots de passe bcrypt, isolation stricte des données entre clients

### 🌗 Divers
- Thème clair/sombre avec détection OS et persistance
- 2 roles : staff (back-office) et contacts apprenants (portail)

## Tests

```bash
python3 tests/e2e_api.py     # 28+ tests API end-to-end
python3 tests/e2e_video.py   # upload + streaming + protection vidéo
```

## Comptes de démonstration (après seed)

| Rôle | Email | Mot de passe |
|---|---|---|
| Staff | `admin@liteudemy.local` | `admin123` |
| Formateur | `formateur@liteudemy.local` | `formateur123` |
| Apprenant | `jean@acme.example` | `demo123` |
# lite-udemy
# lite-udemy
