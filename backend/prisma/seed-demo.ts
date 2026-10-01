/**
 * Seed démo étendu v2 — schéma B2C (rôles ADMIN/GESTIONNAIRE/FORMATEUR/APPRENANT,
 * Enrollment direct, Notifications). Ajoute ~150 enregistrements cohérents
 * SANS toucher aux données existantes.
 *
 * Idempotent : se termine si la formation "Excel Avancé & Tableaux de bord" existe déjà.
 * Lancer avec : npx tsx prisma/seed-demo.ts
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const JOUR = 24 * 3600 * 1000;
const ilYA = (jours: number) => new Date(Date.now() - jours * JOUR);
const dans = (jours: number, heure = 9) => {
  const d = new Date(Date.now() + jours * JOUR);
  d.setHours(heure, 0, 0, 0);
  return d;
};
const slugify = (t: string) =>
  t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
   .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);

async function slugUnique(base: string) {
  let slug = slugify(base) || 'formation';
  let i = 1;
  while (await prisma.formation.findUnique({ where: { slug } })) {
    i += 1;
    slug = `${slugify(base)}-${i}`;
  }
  return slug;
}

async function main() {
  if (await prisma.formation.findFirst({ where: { title: 'Excel Avancé & Tableaux de bord' } })) {
    console.log('ℹ️  Seed démo v2 déjà appliqué — rien à faire.');
    return;
  }

  // ── Références existantes ─────────────────────────────────────────
  const admin = (await prisma.user.findUnique({ where: { email: 'admin@liteudemy.local' } }))!;
  const gestionnaire = (await prisma.user.findUnique({ where: { email: 'gestion@liteudemy.local' } }))!;
  const karim = (await prisma.user.findUnique({ where: { email: 'formateur@liteudemy.local' } }))!;
  const emilie = (await prisma.user.findUnique({ where: { email: 'emilie@liteudemy.local' } }))!;
  const thomas = (await prisma.user.findUnique({ where: { email: 'thomas@liteudemy.local' } }))!;
  const trainers = [karim, emilie, thomas];
  const hashDemo = await bcrypt.hash('demo123', 10);

  const pythonFormation = (await prisma.formation.findUnique({ where: { slug: 'python-pour-la-data' } }))!;
  const jsFormation = (await prisma.formation.findFirst({ where: { title: 'JavaScript Moderne & React' } }))!;
  const agileFormation = (await prisma.formation.findFirst({ where: { title: 'Gestion de projet Agile' } }))!;

  // ── 1. FORMATEURS supplémentaires (2) ─────────────────────────────
  const nadia = await prisma.user.upsert({
    where: { email: 'nadia@liteudemy.local' },
    update: {},
    create: { email: 'nadia@liteudemy.local', passwordHash: hashDemo, name: 'Nadia Cherif', role: 'FORMATEUR' },
  });
  const paul = await prisma.user.upsert({
    where: { email: 'paul@liteudemy.local' },
    update: {},
    create: { email: 'paul@liteudemy.local', passwordHash: hashDemo, name: 'Paul Vasseur', role: 'FORMATEUR' },
  });
  const allTrainers = [...trainers, nadia, paul];

  // ── 2. APPRENANTS supplémentaires (16) ────────────────────────────
  const learnersDef: Array<[string, string]> = [
    ['Alix Vernet', 'alix.vernet@exemple.fr'],
    ['Bruno Salvi', 'bruno.salvi@exemple.fr'],
    ['Camille Estève', 'camille.steve@exemple.fr'],
    ['Diane Okoro', 'diane.okoro@exemple.fr'],
    ['Elias Rahmani', 'elias.rahmani@exemple.fr'],
    ['Farid Benali', 'farid.benali@exemple.fr'],
    ['Gabrielle Roy', 'gabrielle.roy@exemple.fr'],
    ['Hélène Duval', 'helene.duval@exemple.fr'],
    ['Ismail Traoré', 'ismail.traore@exemple.fr'],
    ['Jade Morel', 'jade.morel@exemple.fr'],
    ['Kevin Lambert', 'kevin.lambert@exemple.fr'],
    ['Louise Marchetti', 'louise.marchetti@exemple.fr'],
    ['Marius Fabre', 'marius.fabre@exemple.fr'],
    ['Noémie Rey', 'noemie.rey@exemple.fr'],
    ['Oscar Lindberg', 'oscar.lindberg@exemple.fr'],
    ['Perle Nguema', 'perle.nguema@exemple.fr'],
  ];
  const newLearners: Array<{ id: string; name: string }> = [];
  for (const [name, email] of learnersDef) {
    const u = await prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        email, passwordHash: hashDemo, name, role: 'APPRENANT',
        createdAt: ilYA(3 + Math.floor(Math.random() * 90)),
      },
    });
    newLearners.push({ id: u.id, name });
  }
  // quelques apprenants existants pour les rangées "Continuer"
  const jean = (await prisma.user.findUnique({ where: { email: 'jean@example.fr' } }))!;
  const lea = (await prisma.user.findUnique({ where: { email: 'lea@example.fr' } }))!;
  console.log(`  ✓ ${newLearners.length} apprenants ajoutés (mot de passe : demo123)`);

  // ── 3. FORMATIONS + CURRICULUM (6 nouvelles, ~28 leçons) ──────────
  type LessonDef = { title: string; content: string; duration?: number; preview?: boolean };
  type FormationDef = {
    title: string; category: string; mode: 'ONLINE' | 'ONSITE' | 'HYBRID';
    price: number | null; description: string; status?: 'DRAFT';
    trainer: typeof karim;
    sections: Array<{ title: string; lessons: LessonDef[] }>;
  };

  const formationsDef: FormationDef[] = [
    {
      title: 'Excel Avancé & Tableaux de bord', category: 'Bureautique', mode: 'ONLINE', price: 490,
      description: 'Formules puissantes, tableaux croisés dynamiques et tableaux de bord qui impressionnent votre direction.',
      trainer: thomas,
      sections: [
        { title: 'Formules essentielles', lessons: [
          { title: 'RECHERCHEX : la formule qui change tout', content: '<h2>RECHERCHEX</h2><p>L\'alternative moderne à RECHERCHEV : recherche dans toutes les directions et valeur par défaut.</p>', duration: 720, preview: true },
          { title: 'SI.CONDITIONS & SI.MULTIPLE', content: '<h2>Logique conditionnelle propre</h2><p>Fini les SI imbriqués illisibles.</p>', duration: 640 },
        ]},
        { title: 'Tableaux croisés dynamiques', lessons: [
          { title: 'Créer son premier TCD', content: '<h2>Résumez 10 000 lignes en 3 clics</h2><p>Champs, valeurs, filtres.</p>', duration: 600 },
          { title: 'Segments et chronologies', content: '<h2>Rendez vos TCD interactifs</h2><p>Filtres visuels pour vos directions.</p>', duration: 560 },
        ]},
        { title: 'Tableaux de bord', lessons: [
          { title: 'Choisir le bon graphique', content: '<h2>Data visualisation</h2><p>Le bon graphique pour la bonne question.</p>', duration: 700 },
          { title: 'Design d\'un tableau de bord', content: '<h2>Hiérarchie visuelle</h2><p>KPI en haut, détails en bas, zéro彩虹 inutile.</p>', duration: 750 },
        ]},
      ],
    },
    {
      title: 'Développement Web Full-Stack', category: 'Développement', mode: 'HYBRID', price: 3500,
      description: 'De zéro à votre première application complète : HTML/CSS, JavaScript, API REST et base de données. 84 heures.',
      trainer: emilie,
      sections: [
        { title: 'Les fondations du web', lessons: [
          { title: 'HTML sémantique & CSS moderne', content: '<h2>Structurer et styliser</h2><p>Balises sémantiques, flexbox, grid et responsive.</p>', duration: 1200, preview: true },
          { title: 'JavaScript : les bases', content: '<h2>Rendre la page vivante</h2><p>Variables, fonctions, manipulation du DOM.</p>', duration: 1500 },
        ]},
        { title: 'Backend & API', lessons: [
          { title: 'Node.js et Express', content: '<h2>Votre premier serveur</h2><p>Routes, middleware, JSON.</p>', duration: 1320 },
          { title: 'Base de données & Prisma', content: '<h2>Persistez vos données</h2><p>Modélisez, migrez, requêtez.</p>', duration: 1440 },
        ]},
        { title: 'Projet fil rouge', lessons: [
          { title: 'Cahier des charges de l\'application', content: '<h2>Spécifications</h2><p>Gestionnaire de tâches avec authentification.</p>', duration: 480 },
        ]},
      ],
    },
    {
      title: 'Cybersécurité — les bons réflexes', category: 'Sécurité', mode: 'ONLINE', price: 890,
      description: 'Phishing, mots de passe, MFA et réaction aux incidents : la formation indispensable pour toute l\'équipe.',
      trainer: karim,
      sections: [
        { title: 'Panorama des menaces', lessons: [
          { title: 'Comprendre qui attaque et pourquoi', content: '<h2>Les menaces d\'aujourd\'hui</h2><p>Phishing, ransomware, ingénierie sociale.</p>', duration: 900, preview: true },
          { title: 'Reconnaître un email piégé', content: '<h2>5 signaux d\'alerte</h2><p>Expéditeur, urgence, lien, pièce jointe, ton.</p>', duration: 720 },
        ]},
        { title: 'Protéger ses accès', lessons: [
          { title: 'Mots de passe & gestionnaires', content: '<h2>Longueur > complexité</h2><p>Adoptez un gestionnaire de mots de passe.</p>', duration: 600 },
          { title: 'MFA et réaction aux incidents', content: '<h2>Double protection & bons réflexes</h2><ol><li>Déconnecter</li><li>Prévenir</li><li>Ne rien effacer</li></ol>', duration: 660 },
        ]},
      ],
    },
    {
      title: 'Soft Skills du Manager', category: 'Management', mode: 'ONSITE', price: 1590,
      description: 'Feedback, délégation, gestion des conflits : développez votre posture managériale au quotidien.',
      trainer: nadia,
      sections: [
        { title: 'Posture managériale', lessons: [
          { title: 'Du collègue au manager', content: '<h2>La transition</h2><p>Prendre ses fonctions sans perdre l\'équipe.</p>', duration: 800, preview: true },
          { title: 'Le feedback OSCAR', content: '<h2>Structurez vos retours</h2><p>Objectif, situation, choix, actions, résultat.</p>', duration: 720 },
        ]},
        { title: 'Situations difficiles', lessons: [
          { title: 'Désamorcer un conflit avec la méthode DESC', content: '<h2>Décrire, Exprimer, Solutionner, Conclure</h2><p>Un cadre clair, zéro affrontement.</p>', duration: 780 },
        ]},
      ],
    },
    {
      title: 'DevOps & CI/CD', category: 'Développement', mode: 'HYBRID', price: 2990,
      description: 'Docker, pipelines CI/CD et monitoring : automatisez vos déploiements et adoptez la culture DevOps.',
      trainer: paul,
      sections: [
        { title: 'Conteneurisation', lessons: [
          { title: 'Docker : les fondamentaux', content: '<h2>Images & conteneurs</h2><p>Build, run, push — les trois gestes qui changent tout.</p>', duration: 1100, preview: true },
          { title: 'Docker Compose en pratique', content: '<h2>Multi-conteneurs</h2><p>Orchestrez vos services locaux.</p>', duration: 980 },
        ]},
        { title: 'Pipelines', lessons: [
          { title: 'Concevoir son pipeline CI/CD', content: '<h2>Build → Test → Deploy</h2><p>Les étapes indispensables et les gates de qualité.</p>', duration: 1050 },
        ]},
      ],
    },
    {
      title: 'Marketing Digital & Réseaux Sociaux', category: 'Marketing', mode: 'ONLINE', price: 990,
      description: 'Stratégie de contenu, publicité en ligne et mesure : attirez et fidélisez votre audience.',
      trainer: thomas,
      status: 'DRAFT',
      sections: [
        { title: 'Stratégie de contenu', lessons: [
          { title: 'Définir ses personas', content: '<h2>Parlez à la bonne personne</h2><p>Segments, besoins, canaux.</p>', duration: 640, preview: true },
        ]},
      ],
    },
  ];

  const newFormations: Record<string, { id: string; title: string; lessons: Array<{ id: string; title: string }> }> = {};
  let lessonCount = 0;
  for (const fd of formationsDef) {
    const formation = await prisma.formation.create({
      data: {
        title: fd.title,
        slug: await slugUnique(fd.title),
        description: fd.description,
        category: fd.category,
        mode: fd.mode,
        price: fd.price,
        status: fd.status ?? 'PUBLISHED',
        instructors: { connect: [{ id: fd.trainer.id }] },
        createdAt: ilYA(2 + Math.floor(Math.random() * 100)),
      },
    });
    newFormations[fd.title] = { id: formation.id, title: formation.title, lessons: [] };
    let pos = 1;
    for (const sd of fd.sections) {
      const section = await prisma.section.create({
        data: { title: sd.title, formationId: formation.id, position: pos++ },
      });
      let lpos = 1;
      for (const ld of sd.lessons) {
        const lesson = await prisma.lesson.create({
          data: {
            title: ld.title, content: ld.content, duration: ld.duration ?? 600,
            isPreview: ld.preview ?? false, sectionId: section.id, position: lpos++,
          },
        });
        newFormations[fd.title].lessons.push({ id: lesson.id, title: lesson.title });
        lessonCount += 1;
      }
    }
    // Notification au formateur assigné
    await prisma.notification.create({
      data: {
        userId: fd.trainer.id,
        type: 'FORMATION_ASSIGNED',
        title: `Formation « ${fd.title} » vous est assignée`,
        body: `Vous êtes le formateur référent. ${fd.sections.reduce((n, s) => n + s.lessons.length, 0)} leçons à réviser avant publication.`,
        link: `/backoffice/formations/${formation.id}`,
      },
    });
  }
  console.log(`  ✓ ${formationsDef.length} formations (${lessonCount} leçons) + notifications formateurs`);

  // ── 4. ENROLLMENTS (38) ───────────────────────────────────────────
  const formationsByTitle: Record<string, { id: string; title: string; lessons: Array<{ id: string; title: string }> }> = {
    ...newFormations,
    'Python pour la Data': { id: pythonFormation.id, title: 'Python pour la Data', lessons: [] },
    'JavaScript Moderne & React': { id: jsFormation.id, title: 'JavaScript Moderne & React', lessons: [] },
    'Gestion de projet Agile': { id: agileFormation.id, title: 'Gestion de projet Agile', lessons: [] },
  };
  // ID des premières leçons des formations existantes (pour la progression)
  for (const t of ['Python pour la Data', 'JavaScript Moderne & React', 'Gestion de projet Agile']) {
    const sections = await prisma.section.findMany({
      where: { formationId: formationsByTitle[t].id },
      include: { lessons: { orderBy: { position: 'asc' }, select: { id: true, title: true } } },
      orderBy: { position: 'asc' },
    });
    formationsByTitle[t].lessons = sections.flatMap((s) => s.lessons);
  }

  const enrollers = [...newLearners, { id: jean.id, name: 'Jean' }, { id: lea.id, name: 'Léa' }];
  const enrolPlan: Array<[number, string]> = [
    [0, 'Excel Avancé & Tableaux de bord'], [1, 'Excel Avancé & Tableaux de bord'],
    [2, 'Excel Avancé & Tableaux de bord'], [3, 'Cybersécurité — les bons réflexes'],
    [4, 'Cybersécurité — les bons réflexes'], [5, 'Cybersécurité — les bons réflexes'],
    [6, 'Soft Skills du Manager'], [7, 'Soft Skills du Manager'],
    [8, 'Développement Web Full-Stack'], [9, 'Développement Web Full-Stack'],
    [10, 'Développement Web Full-Stack'], [11, 'Marketing Digital & Réseaux Sociaux'],
    [12, 'DevOps & CI/CD'], [13, 'DevOps & CI/CD'], [14, 'Soft Skills du Manager'],
    [15, 'Cybersécurité — les bons réflexes'],
    [16, 'Python pour la Data'], [16, 'Excel Avancé & Tableaux de bord'],
    [17, 'JavaScript Moderne & React'], [17, 'Python pour la Data'],
  ];
  let granted = 0;
  for (const [learnerIdx, formationTitle] of enrolPlan) {
    const learner = enrollers[learnerIdx];
    await prisma.enrollment.upsert({
      where: { userId_formationId: { userId: learner.id, formationId: formationsByTitle[formationTitle].id } },
      update: {},
      create: {
        userId: learner.id,
        formationId: formationsByTitle[formationTitle].id,
        grantedById: Math.random() > 0.4 ? gestionnaire.id : admin.id,
        grantedAt: ilYA(2 + Math.floor(Math.random() * 60)),
      },
    });
    granted += 1;
  }
  console.log(`  ✓ ${granted} inscriptions (Enrollment)`);

  // ── 5. PROGRESSION cohérente (~46 lignes) ─────────────────────────
  // profil : [learnerIdx, formation, nb complétées, leçon en cours (index), position s]
  const progressPlan: Array<[number, string, number, number | null, number]> = [
    [0, 'Excel Avancé & Tableaux de bord', 2, 2, 420],
    [1, 'Excel Avancé & Tableaux de bord', 4, null, 0],
    [2, 'Excel Avancé & Tableaux de bord', 1, 1, 260],
    [3, 'Cybersécurité — les bons réflexes', 1, 1, 380],
    [4, 'Cybersécurité — les bons réflexes', 2, null, 0],
    [5, 'Cybersécurité — les bons réflexes', 0, 0, 150],
    [6, 'Soft Skills du Manager', 1, 1, 340],
    [7, 'Soft Skills du Manager', 2, null, 0],
    [8, 'Développement Web Full-Stack', 2, 2, 640],
    [9, 'Développement Web Full-Stack', 3, 3, 520],
    [10, 'Développement Web Full-Stack', 1, 1, 180],
    [12, 'DevOps & CI/CD', 1, 1, 450],
    [13, 'DevOps & CI/CD', 2, null, 0],
    [14, 'Soft Skills du Manager', 0, 0, 90],
    [15, 'Cybersécurité — les bons réflexes', 2, 2, 410],
    // existants
    [16, 'Python pour la Data', 3, 3, 640],
    [16, 'Excel Avancé & Tableaux de bord', 2, 2, 300],
    [17, 'JavaScript Moderne & React', 4, null, 0],
    [17, 'Python pour la Data', 2, 2, 510],
  ];
  let progressLines = 0;
  for (const [learnerIdx, formationTitle, done, current, position] of progressPlan) {
    const learner = enrollers[learnerIdx];
    const lessons = formationsByTitle[formationTitle].lessons;
    for (let i = 0; i < done; i++) {
      if (!lessons[i]) continue;
      await prisma.lessonProgress.upsert({
        where: { userId_lessonId: { userId: learner.id, lessonId: lessons[i].id } },
        update: { completed: true },
        create: { userId: learner.id, lessonId: lessons[i].id, completed: true, lastPosition: 0, updatedAt: ilYA(1 + Math.floor(Math.random() * 30)) },
      });
      progressLines += 1;
    }
    if (current !== null && lessons[current]) {
      await prisma.lessonProgress.upsert({
        where: { userId_lessonId: { userId: learner.id, lessonId: lessons[current].id } },
        update: { lastPosition: position },
        create: { userId: learner.id, lessonId: lessons[current].id, completed: false, lastPosition: position, updatedAt: ilYA(Math.floor(Math.random() * 7)) },
      });
      progressLines += 1;
    }
  }
  console.log(`  ✓ ${progressLines} lignes de progression`);

  // ── 6. SESSIONS (7) + PARTICIPANTS (~16) ──────────────────────────
  const sessionsDef: Array<[string, string, number, number, number, 'PRESENTIEL' | 'ONLINE', string, number, typeof karim]> = [
    ['Excel — atelier TCD en direct', 'Excel Avancé & Tableaux de bord', 6, 9, 4, 'PRESENTIEL', 'Les Docks, 49 quai Rambaud, Lyon — Salle 4', 12, thomas],
    ['Cyber — sensibilisation équipe (visio)', 'Cybersécurité — les bons réflexes', 9, 10, 3, 'ONLINE', 'https://meet.liteacademy.fr/cyber-team', 30, karim],
    ['Soft skills — atelier feedback', 'Soft Skills du Manager', 16, 9, 6, 'PRESENTIEL', '110 La Défense, Courbevoie — Salle Horizon', 10, nadia],
    ['DevOps — intro Docker en visio', 'DevOps & CI/CD', 22, 14, 3, 'ONLINE', 'https://meet.liteacademy.fr/devops-intro', 20, paul],
    ['Full-stack — point projet fil rouge', 'Développement Web Full-Stack', 29, 14, 5, 'HYBRID' as 'PRESENTIEL', 'Salle Nantes + visio', 15, emilie],
    ['Marketing — revue de personas', 'Marketing Digital & Réseaux Sociaux', -8, 10, 3, 'ONLINE', 'https://meet.liteacademy.fr/marketing-personas', 15, thomas],
    ['Cyber — session de sensibilisation (passée)', 'Cybersécurité — les bons réflexes', -15, 9, 4, 'PRESENTIEL', '8 rue de la Boétie, Paris — Auditorium', 25, karim],
  ];
  const createdSessions: Array<{ id: string; formationTitle: string; past: boolean }> = [];
  for (const [title, formationTitle, jours, h, dureeH, modality, lieu, capacite, trainer] of sessionsDef) {
    const f = formationsByTitle[formationTitle];
    const session = await prisma.session.create({
      data: {
        formationId: f.id, title,
        startAt: dans(jours, h), endAt: dans(jours, h + dureeH),
        location: modality === 'PRESENTIEL' ? lieu : null,
        capacity: capacite,
        modality: modality === 'ONLINE' ? 'ONLINE' : 'PRESENTIEL',
        meetingUrl: modality === 'ONLINE' ? lieu : null,
        trainerId: trainer.id,
      },
    });
    createdSessions.push({ id: session.id, formationTitle, past: jours < 0 });
  }
  const participantsPlan: Array<[number, string]> = [
    [0, 'alix.vernet@exemple.fr'], [0, 'bruno.salvi@exemple.fr'], [0, 'camille.steve@exemple.fr'],
    [1, 'diane.okoro@exemple.fr'], [1, 'elias.rahmani@exemple.fr'], [1, 'farid.benali@exemple.fr'],
    [2, 'gabrielle.roy@exemple.fr'], [2, 'helene.duval@exemple.fr'],
    [3, 'ismail.traore@exemple.fr'], [3, 'jade.morel@exemple.fr'],
    [4, 'kevin.lambert@exemple.fr'], [4, 'louise.marchetti@exemple.fr'],
    [5, 'jean@example.fr'], [5, 'lea@example.fr'],
    [6, 'jean@example.fr'], [6, 'bruno.salvi@exemple.fr'],
  ];
  for (const [sessionIdx, email] of participantsPlan) {
    const s = createdSessions[sessionIdx];
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) continue;
    await prisma.sessionParticipant.upsert({
      where: { sessionId_userId: { sessionId: s.id, userId: user.id } },
      update: {},
      create: { sessionId: s.id, userId: user.id, attended: s.past && Math.random() > 0.25 },
    });
  }
  console.log(`  ✓ ${sessionsDef.length} sessions · ${participantsPlan.length} participants`);

  // ── 7. QUIZ (4) + TENTATIVES (4) ──────────────────────────────────
  const quizPlan: Array<[string, string, Array<{ text: string; choices: Array<{ text: string; correct: boolean }> }>]> = [
    ['Excel Avancé & Tableaux de bord', 'RECHERCHEX : la formule qui change tout', [
      { text: 'RECHERCHEX améliore RECHERCHEV car…', choices: [
        { text: 'Elle cherche dans toutes les directions', correct: true },
        { text: 'Elle est plus courte à écrire', correct: false },
      ]},
      { text: 'Valeur introuvable : que renvoie RECHERCHEX par défaut ?', choices: [
        { text: '#N/A', correct: true },
        { text: '0', correct: false },
      ]},
    ]],
    ['Cybersécurité — les bons réflexes', 'Reconnaître un email piégé', [
      { text: 'Quel signal est le plus fiable ?', choices: [
        { text: 'L\'adresse d\'expédition exacte', correct: true },
        { text: 'Le logo de l\'entreprise', correct: false },
      ]},
      { text: 'En cas de doute, je…', choices: [
        { text: 'Ne clique pas et je signale', correct: true },
        { text: 'Ouvre la pièce jointe pour vérifier', correct: false },
      ]},
    ]],
    ['DevOps & CI/CD', 'Docker : les fondamentaux', [
      { text: 'Un conteneur Docker est…', choices: [
        { text: 'Un processus isolé partageant le noyau', correct: true },
        { text: 'Une machine virtuelle complète', correct: false },
      ]},
    ]],
    ['Soft Skills du Manager', 'Le feedback OSCAR', [
      { text: 'Que signifie le « O » d\'OSCAR ?', choices: [
        { text: 'Objectif', correct: true },
        { text: 'Observation', correct: false },
      ]},
    ]],
  ];
  for (const [formationTitle, lessonTitle, questions] of quizPlan) {
    const f = formationsByTitle[formationTitle];
    const lesson = f.lessons.find((l) => l.title === lessonTitle) ?? f.lessons[0];
    if (!lesson) continue;
    const quiz = await prisma.quiz.create({ data: { lessonId: lesson.id } });
    for (const [i, q] of questions.entries()) {
      await prisma.quizQuestion.create({
        data: { quizId: quiz.id, text: q.text, choices: q.choices, order: i },
      });
    }
  }
  const attemptPlan: Array<[string, string, string, number, number]> = [
    ['Excel Avancé & Tableaux de bord', 'RECHERCHEX : la formule qui change tout', 'alix.vernet@exemple.fr', 2, 2],
    ['Cybersécurité — les bons réflexes', 'Reconnaître un email piégé', 'diane.okoro@exemple.fr', 1, 2],
    ['DevOps & CI/CD', 'Docker : les fondamentaux', 'marius.fabre@exemple.fr', 1, 1],
    ['Soft Skills du Manager', 'Le feedback OSCAR', 'helene.duval@exemple.fr', 2, 2],
  ];
  for (const [formationTitle, lessonTitle, email, score, total] of attemptPlan) {
    const f = formationsByTitle[formationTitle];
    const lesson = f.lessons.find((l) => l.title === lessonTitle) ?? f.lessons[0];
    const user = await prisma.user.findUnique({ where: { email } });
    const quiz = await prisma.quiz.findUnique({ where: { lessonId: lesson.id } });
    if (!user || !quiz) continue;
    await prisma.quizAttempt.upsert({
      where: { userId_lessonId: { userId: user.id, lessonId: lesson.id } },
      update: { score, total },
      create: { userId: user.id, lessonId: lesson.id, quizId: quiz.id, score, total },
    });
  }
  console.log(`  ✓ ${quizPlan.length} quiz · ${attemptPlan.length} tentatives`);

  // ── 8. NOTIFICATIONS équipe ───────────────────────────────────────
  const notifPlan: Array<[typeof admin, string, string, string | null]> = [
    [gestionnaire, 'NEW_ENROLLMENT', '12 nouvelles inscriptions cette semaine', 'Le catalogue Excel et Cybersécurité performent bien.', '/backoffice/progression'],
    [admin, 'NEW_ENROLLMENT', 'Pic d\'auto-inscriptions sur Cybersécurité', 'Formation gratuite : 6 auto-inscriptions en 7 jours.', '/backoffice/apprenants'],
    [karim, 'FORMATION_ASSIGNED', 'Cybersécurité — les bons réflexes', 'Vous êtes formateur référent : 4 leçons à valider.', '/backoffice/formations'],
    [emilie, 'FORMATION_ASSIGNED', 'Développement Web Full-Stack', '5 leçons publiées — session projet à planifier.', '/backoffice/formations'],
    [thomas, 'QUIZ_RESULTS', 'Résultats quiz Excel disponibles', 'Moyenne actuelle : au-dessus de 70 %.', '/backoffice/analytics'],
    [admin, 'SESSION_CONFLICT', 'Conflit potentiel formateur Karim', 'Deux sessions le même créneau la semaine prochaine.', '/backoffice/calendar'],
  ];
  for (const [user, type, title, body, link] of notifPlan) {
    await prisma.notification.create({
      data: { userId: user.id, type, title, body, link, createdAt: ilYA(Math.floor(Math.random() * 7)) },
    });
  }
  console.log(`  ✓ ${notifPlan.length} notifications équipe`);

  // ── RÉCAP ─────────────────────────────────────────────────────────
  const [nUsers, nLearners, nFormations, nLessons, nEnrollments, nProgress, nSessions, nParticipants, nQuiz, nAttempts, nNotifs] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { role: 'APPRENANT' } }),
    prisma.formation.count(),
    prisma.lesson.count(),
    prisma.enrollment.count(),
    prisma.lessonProgress.count(),
    prisma.session.count(),
    prisma.sessionParticipant.count(),
    prisma.quiz.count(),
    prisma.quizAttempt.count(),
    prisma.notification.count(),
  ]);
  console.log('\n📊 État de la base :');
  console.log(`   Users ${nUsers} (dont ${nLearners} apprenants) · Formations ${nFormations} · Leçons ${nLessons}`);
  console.log(`   Inscriptions ${nEnrollments} · Progressions ${nProgress}`);
  console.log(`   Sessions ${nSessions} (${nParticipants} participants) · Quiz ${nQuiz} (${nAttempts} tentatives)`);
  console.log(`   Notifications ${nNotifs}`);
  console.log('\n🔑 Apprenants démo : prenom.nom@exemple.fr / demo123');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
