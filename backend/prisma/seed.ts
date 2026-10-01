import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seed de démonstration…');

  // ── Staff ───────────────────────────────────────────────────────────
  const adminHash = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@liteudemy.local' },
    update: {},
    create: { email: 'admin@liteudemy.local', passwordHash: adminHash, name: 'Sophie Martin (Admin)', role: 'STAFF' },
  });
  const trainerHash = await bcrypt.hash('formateur123', 10);
  const trainer = await prisma.user.upsert({
    where: { email: 'formateur@liteudemy.local' },
    update: {},
    create: { email: 'formateur@liteudemy.local', passwordHash: trainerHash, name: 'Karim Benali (Formateur)', role: 'STAFF' },
  });

  // ── Clients + contacts ──────────────────────────────────────────────
  const contactHash = await bcrypt.hash('demo123', 10);
  async function ensureClient(where: { name: string }, create: Parameters<typeof prisma.client.create>[0]['data']) {
    const existing = await prisma.client.findFirst({ where });
    return existing ?? (await prisma.client.create({ data: create }));
  }
  const acme = await ensureClient(
    { name: 'ACME Industries' },
    {
      name: 'ACME Industries',
      type: 'COMPANY',
      status: 'CLIENT',
      email: 'contact@acme.example',
      phone: '+33 1 23 45 67 89',
      address: '12 rue des Usines, 75011 Paris',
      notes: 'Grand compte - renouvellement annuel à négocier en décembre.',
    }
  );
  const dupont = await ensureClient(
    { name: 'Marie Dupont' },
    {
      name: 'Marie Dupont',
      type: 'INDIVIDUAL',
      status: 'PROSPECT',
      email: 'marie.dupont@example.fr',
      phone: '+33 6 12 34 56 78',
      notes: 'Intéressée par la formation Python, budget personnel.',
    }
  );

  const jean = await prisma.user.upsert({
    where: { email: 'jean@acme.example' },
    update: {},
    create: {
      email: 'jean@acme.example',
      passwordHash: contactHash,
      name: 'Jean Petit',
      role: 'CONTACT',
      clientId: acme.id,
    },
  });
  const lea = await prisma.user.upsert({
    where: { email: 'lea@acme.example' },
    update: {},
    create: {
      email: 'lea@acme.example',
      passwordHash: contactHash,
      name: 'Léa Blanc',
      role: 'CONTACT',
      clientId: acme.id,
    },
  });

  // ── Formations ──────────────────────────────────────────────────────
  const python = await prisma.formation.upsert({
    where: { slug: 'python-pour-la-data' },
    update: {},
    create: {
      title: 'Python pour la Data',
      slug: 'python-pour-la-data',
      description:
        'Maîtrisez Python pour l’analyse de données : bases du langage, Pandas, visualisation et premières analyses concrètes.',
      category: 'Data',
      mode: 'HYBRID',
      status: 'PUBLISHED',
      price: 1490,
    },
  });
  const gestion = await prisma.formation.upsert({
    where: { slug: 'gestion-de-projet-agile' },
    update: {},
    create: {
      title: 'Gestion de projet Agile',
      slug: 'gestion-de-projet-agile',
      description:
        'Scrum, Kanban et rituels agiles : piloter vos projets avec efficacité en présentiel et en ligne.',
      category: 'Management',
      mode: 'ONSITE',
      status: 'PUBLISHED',
      price: null,
    },
  });

  // Curriculum Python : 2 sections, 4 leçons
  const pySec1 = await prisma.section.upsert({
    where: { id: 'seed-py-sec-1' },
    update: {},
    create: { id: 'seed-py-sec-1', title: 'Introduction à Python', formationId: python.id, position: 1 },
  }).catch(() => null);
  const section1 =
    pySec1 ?? (await prisma.section.findFirst({ where: { formationId: python.id, position: 1 } }))!;

  const pySec2 = await prisma.section.upsert({
    where: { id: 'seed-py-sec-2' },
    update: {},
    create: { id: 'seed-py-sec-2', title: 'Analyse de données avec Pandas', formationId: python.id, position: 2 },
  }).catch(() => null);
  const section2 =
    pySec2 ?? (await prisma.section.findFirst({ where: { formationId: python.id, position: 2 } }))!;

  const lessonsSeed = [
    {
      id: 'seed-py-lesson-1',
      sectionId: section1.id,
      title: 'Bienvenue dans la formation',
      position: 1,
      isPreview: true,
      content:
        '<h2>Bienvenue !</h2><p>Cette formation vous apprend <strong>Python pour la data</strong>, de zéro jusqu’à vos premières analyses.</p><ul><li>Durée totale : ~6h</li><li>Exercices après chaque chapitre</li></ul><p>Regardez la vidéo d’introduction puis lancez-vous !</p>',
    },
    {
      id: 'seed-py-lesson-2',
      sectionId: section1.id,
      title: 'Installer son environnement',
      position: 2,
      isPreview: false,
      content:
        '<h2>Installation</h2><p>Nous utiliserons <strong>Anaconda</strong> et <strong>VS Code</strong>.</p><ol><li>Téléchargez Anaconda (python.org ou anaconda.com)</li><li>Installez VS Code + extension Python</li><li>Créez votre premier notebook</li></ol><p>En cas de problème, consultez la FAQ du chapitre.</p>',
    },
    {
      id: 'seed-py-lesson-3',
      sectionId: section2.id,
      title: 'Les DataFrames en pratique',
      position: 1,
      isPreview: false,
      content:
        '<h2>Pandas 101</h2><p>Le <em>DataFrame</em> est LA structure centrale de Pandas :</p><pre><code>import pandas as pd\ndf = pd.read_csv("ventes.csv")\ndf.head()\ndf.describe()</code></pre><p>Exercice : chargez le fichier ventes.csv et calculez le CA moyen par région.</p>',
    },
    {
      id: 'seed-py-lesson-4',
      sectionId: section2.id,
      title: 'Visualiser ses données',
      position: 2,
      isPreview: false,
      content:
        '<h2>Matplotlib & Seaborn</h2><p>Une image vaut mille lignes de logs :</p><pre><code>import seaborn as sns\nsns.barplot(x="region", y="ca", data=df)</code></pre><p>À vous de jouer : produisez 3 graphiques différents sur le dataset.</p>',
    },
  ];
  for (const l of lessonsSeed) {
    await prisma.lesson.upsert({ where: { id: l.id }, update: {}, create: { ...l } });
  }

  // Curriculum Agile : 1 section, 2 leçons
  const agSec = await prisma.section.upsert({
    where: { id: 'seed-ag-sec-1' },
    update: {},
    create: { id: 'seed-ag-sec-1', title: 'Les fondamentaux de l’agilité', formationId: gestion.id, position: 1 },
  }).catch(() => null);
  const agSection =
    agSec ?? (await prisma.section.findFirst({ where: { formationId: gestion.id, position: 1 } }))!;

  const agileLessons = [
    {
      id: 'seed-ag-lesson-1',
      sectionId: agSection.id,
      title: 'Le manifeste agile en 10 minutes',
      position: 1,
      isPreview: true,
      content:
        '<h2>Le manifeste Agile</h2><p>4 valeurs, 12 principes. L’essentiel : <strong>individus et interactions</strong> plus que processus, <strong>logiciel fonctionnel</strong> plus que documentation exhaustive.</p>',
    },
    {
      id: 'seed-ag-lesson-2',
      sectionId: agSection.id,
      title: 'Scrum : rôles, événements, artefacts',
      position: 2,
      isPreview: false,
      content:
        '<h2>Scrum</h2><ul><li><strong>Rôles</strong> : Product Owner, Scrum Master, équipe</li><li><strong>Événements</strong> : sprint, daily, review, rétrospective</li><li><strong>Artefacts</strong> : backlog produit, backlog sprint, incrément</li></ul>',
    },
  ];
  for (const l of agileLessons) {
    await prisma.lesson.upsert({ where: { id: l.id }, update: {}, create: { ...l } });
  }

  // ── Souscriptions + accès ───────────────────────────────────────────
  const subAcmePython = await prisma.subscription.upsert({
    where: { clientId_formationId: { clientId: acme.id, formationId: python.id } },
    update: {},
    create: { clientId: acme.id, formationId: python.id, seats: 5, status: 'ACTIVE' },
  });
  await prisma.subscription.upsert({
    where: { clientId_formationId: { clientId: acme.id, formationId: gestion.id } },
    update: {},
    create: { clientId: acme.id, formationId: gestion.id, seats: 3, status: 'ACTIVE' },
  });

  await prisma.access.upsert({
    where: { userId_formationId: { userId: jean.id, formationId: python.id } },
    update: {},
    create: { userId: jean.id, formationId: python.id, grantedById: admin.id },
  });
  await prisma.access.upsert({
    where: { userId_formationId: { userId: lea.id, formationId: python.id } },
    update: {},
    create: { userId: lea.id, formationId: python.id, grantedById: admin.id },
  });

  // ── Session présentielle ────────────────────────────────────────────
  const startAt = new Date(Date.now() + 7 * 24 * 3600 * 1000);
  const endAt = new Date(Date.now() + 7 * 24 * 3600 * 1000 + 7 * 3600 * 1000);
  const existingSession = await prisma.session.findFirst({
    where: { formationId: python.id, title: 'Journée intensive Python - Paris' },
  });
  const pySession =
    existingSession ??
    (await prisma.session.create({
      data: {
        formationId: python.id,
        title: 'Journée intensive Python - Paris',
        startAt,
        endAt,
        location: '24 avenue de la République, 75011 Paris - Salle B',
        capacity: 8,
        trainerId: trainer.id,
      },
    }));
  await prisma.sessionParticipant.upsert({
    where: { sessionId_userId: { sessionId: pySession.id, userId: jean.id } },
    update: {},
    create: { sessionId: pySession.id, userId: jean.id },
  });

  // ── Interactions CRM ────────────────────────────────────────────────
  const interactionCount = await prisma.interaction.count({ where: { clientId: dupont.id } });
  if (interactionCount === 0) {
    await prisma.interaction.create({
      data: {
        clientId: dupont.id,
        authorId: admin.id,
        type: 'CALL',
        content: 'Premier contact téléphonique : souhaite un devis pour la formation Python.',
      },
    });
  }

  console.log('✅ Seed terminé.');
  console.log('   Staff     : admin@liteudemy.local / admin123');
  console.log('   Formateur : formateur@liteudemy.local / formateur123');
  console.log('   Contact   : jean@acme.example / demo123 (Python + session présente)');
  console.log('   Contact   : lea@acme.example / demo123 (Python)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
