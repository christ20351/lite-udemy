import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

/** Leçon : contenu structuré par blocs (texte riche, code, encadrés). */
type Block = { type: 'text' | 'code' | 'callout' | 'image'; text?: string; caption?: string };

async function main() {
  console.log('🌱 Seed de démonstration…');

  // ══════════════════════════════════════════════════════════════════
  // ÉQUIPE : 1 admin, 2 gestionnaires, 3 formateurs spécialisés
  // ══════════════════════════════════════════════════════════════════
  const admin = await prisma.user.upsert({
    where: { email: 'admin@liteudemy.local' },
    update: {},
    create: {
      email: 'admin@liteudemy.local',
      passwordHash: await bcrypt.hash('admin123', 10),
      name: 'Sophie Martin',
      role: 'ADMIN',
    },
  });

  const gestion = async (email: string, name: string) =>
    prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        email,
        passwordHash: await bcrypt.hash('gestion123', 10),
        name,
        role: 'GESTIONNAIRE',
      },
    });
  const claire = await gestion('gestion@liteudemy.local', 'Claire Dubois');
  const marc = await gestion('marc@liteudemy.local', 'Marc Lefèvre');

  const formateur = async (email: string, name: string) =>
    prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        email,
        passwordHash: await bcrypt.hash('formateur123', 10),
        name,
        role: 'FORMATEUR',
      },
    });
  const karim = await formateur('formateur@liteudemy.local', 'Karim Benali');
  const emilie = await formateur('emilie@liteudemy.local', 'Émilie Rousseau');
  const thomas = await formateur('thomas@liteudemy.local', 'Thomas Nguyen');

  // ══════════════════════════════════════════════════════════════════
  // APPRENANTS
  // ══════════════════════════════════════════════════════════════════
  const learnerHash = await bcrypt.hash('demo123', 10);
  const apprenant = async (email: string, name: string) =>
    prisma.user.upsert({
      where: { email },
      update: {},
      create: { email, passwordHash: learnerHash, name, role: 'APPRENANT' },
    });
  const jean = await apprenant('jean@example.fr', 'Jean Petit');
  const lea = await apprenant('lea@example.fr', 'Léa Blanc');
  const marie = await apprenant('marie@example.fr', 'Marie Dupont');
  const hugo = await apprenant('hugo@example.fr', 'Hugo Marchand');
  const chloe = await apprenant('chloe@example.fr', 'Chloé Fontaine');
  const sophia = await apprenant('sophia@example.fr', 'Sophia Bertrand');
  const lucas = await apprenant('lucas@example.fr', 'Lucas Girard');
  const emma = await apprenant('emma@example.fr', 'Emma Caron');

  // ══════════════════════════════════════════════════════════════════
  // HELPERS
  // ══════════════════════════════════════════════════════════════════
  async function ensureFormation(data: {
    slug: string;
    title: string;
    description: string;
    category: string;
    mode: 'ONLINE' | 'ONSITE' | 'HYBRID';
    status: 'DRAFT' | 'PUBLISHED';
    price: number | null;
    instructorId: string;
  }) {
    return prisma.formation.upsert({
      where: { slug: data.slug },
      update: {},
      create: {
        title: data.title,
        slug: data.slug,
        description: data.description,
        category: data.category,
        mode: data.mode,
        status: data.status,
        price: data.price,
        instructors: { connect: { id: data.instructorId } },
      },
    });
  }

  async function ensureSection(id: string, title: string, formationId: string, position: number) {
    return prisma.section.upsert({
      where: { id },
      update: {},
      create: { id, title, formationId, position },
    });
  }

  async function ensureLesson(
    id: string,
    sectionId: string,
    data: { title: string; position: number; isPreview?: boolean; blocks: Block[] }
  ) {
    return prisma.lesson.upsert({
      where: { id },
      update: {},
      create: { id, sectionId, title: data.title, position: data.position, isPreview: data.isPreview ?? false, blocks: data.blocks },
    });
  }

  async function ensureQuiz(lessonId: string, questions: Array<{ text: string; choices: Array<{ text: string; correct: boolean }> }>) {
    const existing = await prisma.quiz.findUnique({ where: { lessonId } });
    if (existing) return existing;
    return prisma.quiz.create({
      data: {
        lessonId,
        questions: {
          create: questions.map((q, i) => ({ text: q.text, choices: q.choices, order: i })),
        },
      },
    });
  }

  async function ensureEnrollment(userId: string, formationId: string, grantedById: string | null) {
    return prisma.enrollment.upsert({
      where: { userId_formationId: { userId, formationId } },
      update: {},
      create: { userId, formationId, grantedById },
    });
  }

  async function ensureProgress(userId: string, lessonId: string, opts: { completed: boolean; lastPosition?: number }) {
    return prisma.lessonProgress.upsert({
      where: { userId_lessonId: { userId, lessonId } },
      update: {},
      create: { userId, lessonId, completed: opts.completed, lastPosition: opts.lastPosition ?? 0 },
    });
  }

  async function ensureAttempt(userId: string, lessonId: string, quizId: string, score: number, total: number) {
    return prisma.quizAttempt.upsert({
      where: { userId_lessonId: { userId, lessonId } },
      update: {},
      create: { userId, lessonId, quizId, score, total },
    });
  }

  // ══════════════════════════════════════════════════════════════════
  // FORMATION 1 — Python pour la Data (Karim, payante, publiée)
  // ══════════════════════════════════════════════════════════════════
  const python = await ensureFormation({
    slug: 'python-pour-la-data',
    title: 'Python pour la Data',
    description:
      'Maîtrisez Python pour l’analyse de données : bases du langage, Pandas, nettoyage et visualisation, jusqu’à un mini-projet concret d’analyse de ventes.',
    category: 'Data',
    mode: 'HYBRID',
    status: 'PUBLISHED',
    price: 1490,
    instructorId: karim.id,
  });

  const pyS1 = await ensureSection('seed-py-sec-1', 'Introduction à Python', python.id, 1);
  const pyS2 = await ensureSection('seed-py-sec-2', 'Analyse de données avec Pandas', python.id, 2);
  const pyS3 = await ensureSection('seed-py-sec-3', 'Projet final', python.id, 3);

  const pyL1 = await ensureLesson('seed-py-lesson-1', pyS1.id, {
    title: 'Bienvenue dans la formation',
    position: 1,
    isPreview: true,
    blocks: [
      {
        type: 'text',
        text: '<h2>Bienvenue !</h2><p>Cette formation vous fait passer de <strong>zéro</strong> à vos premières analyses de données complètes avec Python.</p><ul><li>~8 h de contenu, 7 leçons</li><li>Des exercices concrets après chaque chapitre</li><li>Un mini-projet final : analyser un vrai fichier de ventes</li></ul>',
      },
      {
        type: 'callout',
        text: 'Aucun prérequis en programmation. Un ordinateur (Windows, macOS ou Linux) et un peu de curiosité suffisent.',
      },
      {
        type: 'text',
        text: '<h3>Le programme en un coup d’œil</h3><ol><li>Installation de votre environnement</li><li>Variables, types et premières fonctions</li><li>Pandas : charger et explorer des données</li><li>Nettoyer un jeu de données</li><li>Créer des visualisations</li><li>Mini-projet final</li></ol>',
      },
    ],
  });

  const pyL2 = await ensureLesson('seed-py-lesson-2', pyS1.id, {
    title: 'Installer son environnement',
    position: 2,
    blocks: [
      {
        type: 'text',
        text: '<h2>Deux outils, tout est dedans</h2><p>Nous utiliserons <strong>Anaconda</strong> (distribution Python + gestion des librairies) et <strong>VS Code</strong> (éditeur de code).</p>',
      },
      { type: 'code', text: '# 1. Téléchargez Anaconda depuis anaconda.com\n# 2. Installez VS Code + l\'extension Python\n# 3. Vérifiez votre installation :\npython --version\nconda list pandas' },
      {
        type: 'callout',
        text: 'Astuce : créez un environnement dédié par projet (« conda create -n data python=3.12 ») pour éviter les conflits de versions.',
      },
    ],
  });

  const pyL3 = await ensureLesson('seed-py-lesson-3', pyS1.id, {
    title: 'Variables et types de base',
    position: 3,
    blocks: [
      {
        type: 'text',
        text: '<h2>Les briques élémentaires</h2><p>En Python, une variable se crée simplement en l’affectant. Les types de base : <strong>int</strong>, <strong>float</strong>, <strong>str</strong>, <strong>bool</strong> et <strong>list</strong>.</p>',
      },
      { type: 'code', text: 'ca = 15200            # int\nprix_moyen = 42.5     # float\nregion = "Nord"       # str\nen_ligne = True       # bool\nventes = [120, 95, 143, 87]  # list\n\nprint(f"CA de {region} : {ca} €, soit {ca/len(ventes):.1f} € par vente")' },
      {
        type: 'text',
        text: '<h2>À retenir</h2><p>La fonction <code>f"..."</code> (f-string) insère des variables directement dans du texte — vous l’utiliserez sans arrêt pour formater vos résultats d’analyse.</p>',
      },
    ],
  });

  const pyL4 = await ensureLesson('seed-py-lesson-4', pyS2.id, {
    title: 'Les DataFrames en pratique',
    position: 1,
    blocks: [
      {
        type: 'text',
        text: '<h2>Pandas 101</h2><p>Le <em>DataFrame</em> est LA structure centrale de Pandas : un tableau avec des colonnes nommées, comme un fichier Excel mais programmable.</p>',
      },
      { type: 'code', text: 'import pandas as pd\n\ndf = pd.read_csv("ventes.csv")\ndf.head()          # aperçu des 5 premières lignes\ndf.describe()      # statistiques descriptives\ndf["region"].value_counts()   # effectifs par région' },
      {
        type: 'callout',
        text: 'Exercice : chargez ventes.csv et calculez le CA moyen par région avec df.groupby("region")["ca"].mean().',
      },
    ],
  });

  const pyL5 = await ensureLesson('seed-py-lesson-5', pyS2.id, {
    title: 'Nettoyer ses données',
    position: 2,
    blocks: [
      {
        type: 'text',
        text: '<h2>80 % du travail d’un analyste</h2><p>Les données réelles sont toujours imparfaites : valeurs manquantes, doublons, formats incohérents. Pandas fournit tout pour les traiter.</p>',
      },
      { type: 'code', text: 'df.isna().sum()                    # où sont les trous ?\ndf = df.dropna(subset=["client"])  # retirer les lignes sans client\ndf["ca"] = df["ca"].fillna(0)      # combler les CA manquants\ndf = df.drop_duplicates()          # dédoublonner\ndf["date"] = pd.to_datetime(df["date"])  # normaliser les dates' },
      {
        type: 'callout',
        text: 'Règle d’or : ne supprimez une ligne qu’après avoir vérifié qu’elle est réellement inutilisable. Chaque suppression doit être documentée.',
      },
    ],
  });

  const pyL6 = await ensureLesson('seed-py-lesson-6', pyS2.id, {
    title: 'Visualiser ses données',
    position: 3,
    blocks: [
      {
        type: 'text',
        text: '<h2>Une image vaut mille lignes de logs</h2><p>Avec <strong>Seaborn</strong>, trois lignes suffisent pour un graphique présentable en réunion.</p>',
      },
      { type: 'code', text: 'import seaborn as sns\nimport matplotlib.pyplot as plt\n\nsns.barplot(x="region", y="ca", data=df, errorbar=None)\nplt.title("CA par région")\nplt.tight_layout()\nplt.savefig("ca_par_region.png", dpi=150)' },
      {
        type: 'text',
        text: '<h2>Quel graphique pour quel besoin ?</h2><ul><li><strong>Comparaison</strong> → barres (barplot)</li><li><strong>Évolution dans le temps</strong> → courbe (lineplot)</li><li><strong>Distribution</strong> → histogramme (histplot)</li><li><strong>Relation</strong> → nuage de points (scatterplot)</li></ul>',
      },
    ],
  });

  const pyL7 = await ensureLesson('seed-py-lesson-7', pyS3.id, {
    title: 'Mini-projet : analyse de ventes',
    position: 1,
    blocks: [
      {
        type: 'text',
        text: '<h2>Votre première analyse complète</h2><p>À partir du fichier <code>ventes_2026.csv</code> fourni, produisez une analyse en 4 étapes :</p><ol><li>Chargement et exploration (head, describe, value_counts)</li><li>Nettoyage documenté (manquants, doublons, dates)</li><li>Deux visualisations : CA par mois et top 5 des produits</li><li>Un paragraphe de synthèse : quelle recommandation pour le trimestre suivant ?</li></ol>',
      },
      {
        type: 'callout',
        text: 'Livrable : un notebook .ipynb. La correction détaillée est disponible dans la ressource de fin de module.',
      },
    ],
  });

  const pyQuiz4 = await ensureQuiz(pyL4.id, [
    {
      text: 'Quelle méthode affiche les premières lignes d’un DataFrame ?',
      choices: [
        { text: 'df.head()', correct: true },
        { text: 'df.first()', correct: false },
        { text: 'df.top()', correct: false },
      ],
    },
    {
      text: 'Quelle librairie est centrale pour l’analyse de données en Python ?',
      choices: [
        { text: 'Pandas', correct: true },
        { text: 'Flask', correct: false },
        { text: 'Requests', correct: false },
      ],
    },
    {
      text: 'Que fait df.groupby("region")["ca"].mean() ?',
      choices: [
        { text: 'Le CA moyen pour chaque région', correct: true },
        { text: 'La moyenne de toutes les colonnes', correct: false },
        { text: 'Le tri des régions par CA', correct: false },
      ],
    },
  ]);

  const pyQuiz6 = await ensureQuiz(pyL6.id, [
    {
      text: 'Quel graphique choisir pour montrer l’évolution du CA sur 12 mois ?',
      choices: [
        { text: 'Une courbe (lineplot)', correct: true },
        { text: 'Un camembert', correct: false },
        { text: 'Un nuage de points', correct: false },
      ],
    },
    {
      text: 'À quoi sert plt.tight_layout() ?',
      choices: [
        { text: 'À éviter que les labels se chevauchent', correct: true },
        { text: 'À compresser le fichier image', correct: false },
        { text: 'À choisir les couleurs du graphique', correct: false },
      ],
    },
  ]);

  // ══════════════════════════════════════════════════════════════════
  // FORMATION 2 — JavaScript Moderne & React (Émilie, payante, publiée)
  // ══════════════════════════════════════════════════════════════════
  const js = await ensureFormation({
    slug: 'javascript-moderne-react',
    title: 'JavaScript Moderne & React',
    description:
      'De la syntaxe ES6+ aux hooks de React : construire des interfaces composables et réactives, jusqu’à un projet complet de liste de tâches.',
    category: 'Développement web',
    mode: 'ONLINE',
    status: 'PUBLISHED',
    price: 1290,
    instructorId: emilie.id,
  });

  const jsS1 = await ensureSection('seed-js-sec-1', 'Les bases de JavaScript moderne', js.id, 1);
  const jsS2 = await ensureSection('seed-js-sec-2', 'React en pratique', js.id, 2);

  const jsL1 = await ensureLesson('seed-js-lesson-1', jsS1.id, {
    title: 'Bienvenue et présentation du parcours',
    position: 1,
    isPreview: true,
    blocks: [
      {
        type: 'text',
        text: '<h2>Objectif : coder comme en 2026</h2><p>JavaScript évolue vite. Ce parcours couvre la syntaxe <strong>ES6+</strong> réellement utilisée en entreprise, puis l’écosystème <strong>React</strong> avec ses hooks.</p><ul><li>6 leçons progressives, 100 % en ligne</li><li>Chaque concept est immédiatement mis en pratique</li><li>Projet final : une application de liste de tâches</li></ul>',
      },
      {
        type: 'callout',
        text: 'Prérequis : avoir codé au moins un peu de HTML/CSS. Aucune connaissance de JavaScript nécessaire.',
      },
    ],
  });

  const jsL2 = await ensureLesson('seed-js-lesson-2', jsS1.id, {
    title: 'Variables, fonctions fléchées et template literals',
    position: 2,
    blocks: [
      {
        type: 'text',
        text: '<h2>Les trois réflexes ES6</h2><p>On abandonne <code>var</code> pour <strong>const</strong> et <strong>let</strong>, on écrit des fonctions courtes avec <strong>=&gt;</strong> et on assemble du texte avec les <strong>template literals</strong>.</p>',
      },
      { type: 'code', text: 'const prenom = "Hugo";\nlet score = 0;\n\nconst doubler = (n) => n * 2;          // fonction fléchée\nconst saluer = (nom) => `Bonjour ${nom} !`;  // template literal\n\nconsole.log(saluer(prenom));   // "Bonjour Hugo !"\nconsole.log(doubler(21));      // 42' },
      {
        type: 'callout',
        text: 'Règle simple : const par défaut, let seulement si la variable doit changer. var ? Oubliez-le.',
      },
    ],
  });

  const jsL3 = await ensureLesson('seed-js-lesson-3', jsS1.id, {
    title: 'Destructuring et spread operator',
    position: 3,
    blocks: [
      {
        type: 'text',
        text: '<h2>Extraire et étendre sans effort</h2><p>Le <strong>destructuring</strong> déballe objets et tableaux ; le <strong>spread</strong> (...) copie et fusionne. Ce sont les deux gestes que vous répéterez toute la journée en React.</p>',
      },
      { type: 'code', text: 'const user = { nom: "Chloé", role: "admin", actif: true };\nconst { nom, role } = user;          // destructuring\n\nconst prefs = ["thème sombre", "notifications"];\nconst nouveaux = [...prefs, "emails"];   // spread\n\nfunction mettreAJour(user, changements) {\n  return { ...user, ...changements };    // fusion immuable\n}' },
      {
        type: 'callout',
        text: 'Pourquoi le spread partout en React ? Parce qu’on ne modifie jamais un state directement : on en crée une copie modifiée.',
      },
    ],
  });

  const jsL4 = await ensureLesson('seed-js-lesson-4', jsS2.id, {
    title: 'Composants et props',
    position: 1,
    blocks: [
      {
        type: 'text',
        text: '<h2>Des briques réutilisables</h2><p>Un composant React est une fonction qui reçoit des <strong>props</strong> et retourne du JSX. On compose l’interface comme des LEGO.</p>',
      },
      { type: 'code', text: 'function Carte({ titre, enfants }) {\n  return (\n    <div className="carte">\n      <h3>{titre}</h3>\n      {enfants}\n    </div>\n  );\n}\n\n<Carte titre="Formation JS">\n  <p>6 leçons, projet final inclus.</p>\n</Carte>' },
    ],
  });

  const jsL5 = await ensureLesson('seed-js-lesson-5', jsS2.id, {
    title: 'State et hooks : useState, useEffect',
    position: 2,
    blocks: [
      {
        type: 'text',
        text: '<h2>Donner de la vie à vos composants</h2><p><strong>useState</strong> mémorise une donnée qui change ; <strong>useEffect</strong> réagit aux changements (appels réseau, abonnements…).</p>',
      },
      { type: 'code', text: 'import { useState, useEffect } from "react";\n\nfunction Compteur() {\n  const [count, setCount] = useState(0);\n\n  useEffect(() => {\n    document.title = `Score : ${count}`;\n  }, [count]);   // relancé à chaque changement de count\n\n  return <button onClick={() => setCount(count + 1)}>+1 ({count})</button>;\n}' },
      {
        type: 'callout',
        text: 'Le tableau de dépendances [count] est crucial : sans lui, l’effet tourne à chaque rendu ; avec [], une seule fois au montage.',
      },
    ],
  });

  const jsL6 = await ensureLesson('seed-js-lesson-6', jsS2.id, {
    title: 'Projet : liste de tâches',
    position: 3,
    blocks: [
      {
        type: 'text',
        text: '<h2>Assembler le tout</h2><p>Construisez une liste de tâches complète : <strong>Ajouter</strong> (form + state), <strong>Cocher</strong> (mise à jour immuable avec spread), <strong>Filtrer</strong> (toutes / actives / terminées), <strong>Persister</strong> dans localStorage via useEffect.</p>',
      },
      {
        type: 'callout',
        text: 'Bonus pour aller plus loin : ajoutez la suppression avec un bouton, et sauvegardez le filtre actif dans l’URL.',
      },
    ],
  });

  const jsQuiz3 = await ensureQuiz(jsL3.id, [
    {
      text: 'Que fait const { nom } = user ; ?',
      choices: [
        { text: 'Il extrait la propriété nom de user dans une variable', correct: true },
        { text: 'Il copie tout l’objet user', correct: false },
        { text: 'Il supprime nom de user', correct: false },
      ],
    },
    {
      text: 'Quelle syntaxe crée une copie du tableau prefs avec un élément en plus ?',
      choices: [
        { text: '[...prefs, "emails"]', correct: true },
        { text: 'prefs + "emails"', correct: false },
        { text: 'copy(prefs, "emails")', correct: false },
      ],
    },
  ]);

  const jsQuiz5 = await ensureQuiz(jsL5.id, [
    {
      text: 'À quoi sert useState ?',
      choices: [
        { text: 'À mémoriser une donnée qui change dans un composant', correct: true },
        { text: 'À faire des appels réseau', correct: false },
        { text: 'À déclarer une constante globale', correct: false },
      ],
    },
    {
      text: 'Quand est relancé un useEffect avec [count] en dépendance ?',
      choices: [
        { text: 'À chaque changement de count', correct: true },
        { text: 'Une seule fois au montage', correct: false },
        { text: 'À chaque rendu, quelle que soit la cause', correct: false },
      ],
    },
  ]);

  // ══════════════════════════════════════════════════════════════════
  // FORMATION 3 — Gestion de projet Agile (Thomas, gratuite, publiée)
  // ══════════════════════════════════════════════════════════════════
  const agile = await ensureFormation({
    slug: 'gestion-de-projet-agile',
    title: 'Gestion de projet Agile',
    description:
      'Scrum, Kanban et rituels agiles : piloter vos projets avec efficacité. Formation gratuite, idéale pour découvrir les méthodes agiles avant de se lancer.',
    category: 'Management',
    mode: 'ONSITE',
    status: 'PUBLISHED',
    price: null,
    instructorId: thomas.id,
  });

  const agS1 = await ensureSection('seed-ag-sec-1', 'Les fondamentaux de l’agilité', agile.id, 1);
  const agS2 = await ensureSection('seed-ag-sec-2', 'Passer à l’action', agile.id, 2);

  const agL1 = await ensureLesson('seed-ag-lesson-1', agS1.id, {
    title: 'Le manifeste agile en 10 minutes',
    position: 1,
    isPreview: true,
    blocks: [
      {
        type: 'text',
        text: '<h2>4 valeurs, 12 principes</h2><p>Né en 2001, le manifeste agile privilégie :</p><ul><li><strong>Les individus et leurs interactions</strong> plus que les processus et outils</li><li><strong>Un logiciel fonctionnel</strong> plus qu’une documentation exhaustive</li><li><strong>La collaboration avec le client</strong> plus que la négociation contractuelle</li><li><strong>L’adaptation au changement</strong> plus que le suivi d’un plan figé</li></ul>',
      },
      {
        type: 'callout',
        text: 'Idée reçue à débusquer : « agile = sans méthode ». C’est l’inverse : un cadre court et discipliné, livré toutes les 2 semaines.',
      },
    ],
  });

  const agL2 = await ensureLesson('seed-ag-lesson-2', agS1.id, {
    title: 'Scrum : rôles, événements, artefacts',
    position: 2,
    blocks: [
      {
        type: 'text',
        text: '<h2>Le cadre le plus répandu</h2><p><strong>Rôles</strong> : Product Owner (le quoi), Scrum Master (le comment du processus), équipe de développement.<br/><strong>Événements</strong> : sprint (1-4 semaines), daily 15 min, review, rétrospective.<br/><strong>Artefacts</strong> : backlog produit, backlog de sprint, incrément.</p>',
      },
      {
        type: 'callout',
        text: 'Mémorisez ceci : le PO trie par valeur business, l’équipe estime l’effort. La négociation a lieu sur le contenu du sprint, jamais sur la qualité.',
      },
    ],
  });

  const agL3 = await ensureLesson('seed-ag-lesson-3', agS2.id, {
    title: 'Kanban et gestion du backlog',
    position: 1,
    blocks: [
      {
        type: 'text',
        text: '<h2>Visualiser pour fluidifier</h2><p>Un tableau Kanban (À faire / En cours / Terminé) avec des <strong>limites de WIP</strong> (work in progress) fait apparaître immédiatement les goulots d’étranglement.</p><ul><li>Une carte = une tâche livrable en moins de 2 jours</li><li>Limites de WIP : max 2 tâches « En cours » par personne</li><li>Le backlog est trié par valeur, jamais par ancienneté</li></ul>',
      },
      {
        type: 'callout',
        text: 'Vous utilisez déjà ce principe : la page « Progression » de Lite Academy est un kanban — une carte par inscription, positionnée selon la progression réelle.',
      },
    ],
  });

  const agL4 = await ensureLesson('seed-ag-lesson-4', agS2.id, {
    title: 'Animer une réunion quotidienne efficace',
    position: 2,
    blocks: [
      {
        type: 'text',
        text: '<h2>15 minutes, debout, pas plus</h2><p>La daily n’est pas un rapport au chef : c’est <strong>l’équipe qui se synchronise entre elle</strong>. Trois questions : qu’ai-je fait hier ? que fais-je aujourd’hui ? qu’est-ce qui me bloque ?</p><ul><li>Les blocages se traitent <em>après</em> la daily, en petit comité</li><li>Si la daily dépasse 15 min régulièrement : le format est à revoir</li></ul>',
      },
      {
        type: 'callout',
        text: 'Exercice : lors de votre prochain atelier présentiel, nous simulerons une semaine complète de sprints — daily, review et rétrospective comprises.',
      },
    ],
  });

  const agQuiz2 = await ensureQuiz(agL2.id, [
    {
      text: 'Qui est responsable du tri du backlog par valeur ?',
      choices: [
        { text: 'Le Product Owner', correct: true },
        { text: 'Le Scrum Master', correct: false },
        { text: 'L’équipe de développement', correct: false },
      ],
    },
    {
      text: 'Quelle est la durée recommandée d’une daily meeting ?',
      choices: [
        { text: '15 minutes', correct: true },
        { text: '45 minutes', correct: false },
        { text: 'Une heure', correct: false },
      ],
    },
  ]);

  const agQuiz4 = await ensureQuiz(agL4.id, [
    {
      text: 'Que fait-on d’un blocage remonté pendant la daily ?',
      choices: [
        { text: 'On le traite après la daily, en petit comité', correct: true },
        { text: 'On en discute jusqu’à résolution pendant la daily', correct: false },
        { text: 'On l’ajoute au backlog produit', correct: false },
      ],
    },
  ]);

  // ══════════════════════════════════════════════════════════════════
  // FORMATION 4 — Communication Professionnelle (Thomas, payante)
  // ══════════════════════════════════════════════════════════════════
  const com = await ensureFormation({
    slug: 'communication-professionnelle',
    title: 'Communication Professionnelle',
    description:
      'Écoute active, écrits professionnels et prise de parole : des techniques concrètes pour être clair, crédible et à l’aise dans tous vos échanges.',
    category: 'Soft skills',
    mode: 'ONLINE',
    status: 'PUBLISHED',
    price: 890,
    instructorId: thomas.id,
  });

  const comS1 = await ensureSection('seed-com-sec-1', 'Communiquer avec impact', com.id, 1);

  const comL1 = await ensureLesson('seed-com-lesson-1', comS1.id, {
    title: 'Écoute active et reformulation',
    position: 1,
    isPreview: true,
    blocks: [
      {
        type: 'text',
        text: '<h2>Écouter, c’est déjà répondre</h2><p>L’écoute active repose sur trois gestes : <strong>accueillir</strong> (sans interrompre), <strong>reformuler</strong> (« si je comprends bien… »), <strong>approfondir</strong> (questions ouvertes).</p>',
      },
      {
        type: 'callout',
        text: 'Test rapide : dans votre prochaine réunion, ne donnez votre avis qu’après avoir reformulé ce qu’a dit votre interlocuteur. Observez la différence.',
      },
    ],
  });

  const comL2 = await ensureLesson('seed-com-lesson-2', comS1.id, {
    title: 'Emails professionnels : structure et ton',
    position: 2,
    blocks: [
      {
        type: 'text',
        text: '<h2>Le format BLUF</h2><p>Commencez par l’essentiel (<em>Bottom Line Up Front</em>) : l’objet annonce l’action, la première ligne donne la conclusion, le détail suit.</p><ul><li>Objet : <strong>Action attendue + délai</strong> (« Validation budget — avant vendredi »)</li><li>Un email = un sujet</li><li>Destinataires « À » = on attend une action ; « Cc » = pour information</li></ul>',
      },
      {
        type: 'callout',
        text: 'Relisez-vous à voix basse : si une phrase demande de reprendre de l’air, elle est trop longue.',
      },
    ],
  });

  const comL3 = await ensureLesson('seed-com-lesson-3', comS1.id, {
    title: 'Présenter en réunion',
    position: 3,
    blocks: [
      {
        type: 'text',
        text: '<h2>Une idée, un message</h2><p>Structurez toute présentation en trois temps : <strong>situation</strong> (où en est-on ?), <strong>complication</strong> (quel problème ?), <strong>résolution</strong> (que proposez-vous ?). C’est la trame Pyramid de Minto.</p>',
      },
      {
        type: 'callout',
        text: 'Vos slides soutiennent votre propos : max 1 idée par slide, jamais de phrase complète lue à voix haute.',
      },
    ],
  });

  const comQuiz2 = await ensureQuiz(comL2.id, [
    {
      text: 'Que doit annoncer l’objet d’un email professionnel ?',
      choices: [
        { text: 'L’action attendue et le délai', correct: true },
        { text: 'Le nom du destinataire', correct: false },
        { text: 'Un simple mot-clé', correct: false },
      ],
    },
  ]);

  // ══════════════════════════════════════════════════════════════════
  // FORMATION 5 — Cybersécurité (Karim, BROUILLON : en construction)
  // ══════════════════════════════════════════════════════════════════
  const cyber = await ensureFormation({
    slug: 'cybersecurite-les-essentiels',
    title: 'Cybersécurité : les essentiels',
    description:
      'Mots de passe, phishing, bons réflexes au quotidien : protégez vos comptes et vos données professionnelles sans jargon technique.',
    category: 'Sécurité',
    mode: 'ONLINE',
    status: 'DRAFT',
    price: 690,
    instructorId: karim.id,
  });

  const cyS1 = await ensureSection('seed-cy-sec-1', 'Vos premiers réflexes', cyber.id, 1);

  const cyL1 = await ensureLesson('seed-cy-lesson-1', cyS1.id, {
    title: 'Mots de passe et gestionnaires',
    position: 1,
    isPreview: true,
    blocks: [
      {
        type: 'text',
        text: '<h2>Un mot de passe unique par service</h2><p>La réutilisation est la première cause de compromission : un site piraté, et c’est toute votre vie numérique qui fuit. La solution tient en deux mots : <strong>gestionnaire de mots de passe</strong>.</p>',
      },
      {
        type: 'callout',
        text: 'À retenir : la longueur bat la complexité. « cheval-carotte-voyage-2026 » est bien plus solide que « Ch3val! ».',
      },
    ],
  });

  const cyL2 = await ensureLesson('seed-cy-lesson-2', cyS1.id, {
    title: 'Phishing : reconnaître les arnaques',
    position: 2,
    blocks: [
      {
        type: 'text',
        text: '<h2>Les 4 signaux d’alerte</h2><ul><li>Urgence artificielle (« votre compte sera suspendu sous 24 h »)</li><li>Expéditeur presque correct (@micros0ft.com)</li><li>Lien dont le domaine réel diffère du texte affiché</li><li>Pièce jointe inattendue (.zip, .html)</li></ul>',
      },
      {
        type: 'callout',
        text: 'En cas de doute : ne cliquez pas, retrouvez le site officiel vous-même. Aucun organisme légitime ne demande votre mot de passe par email.',
      },
    ],
  });

  const cyQuiz2 = await ensureQuiz(cyL2.id, [
    {
      text: 'Parmi ces signaux, lequel est typique d’un phishing ?',
      choices: [
        { text: 'Une urgence artificielle (« sous 24 h »)', correct: true },
        { text: 'Un email sans logo', correct: false },
        { text: 'Un email envoyé un lundi', correct: false },
      ],
    },
  ]);

  // ══════════════════════════════════════════════════════════════════
  // INSCRIPTIONS (gratuit = auto-inscription, payant = accordé par l'équipe)
  // ══════════════════════════════════════════════════════════════════
  await ensureEnrollment(jean.id, python.id, claire.id);
  await ensureEnrollment(lea.id, python.id, claire.id);
  await ensureEnrollment(lucas.id, python.id, marc.id);
  await ensureEnrollment(hugo.id, js.id, claire.id);
  await ensureEnrollment(chloe.id, js.id, marc.id);
  await ensureEnrollment(sophia.id, com.id, claire.id);
  await ensureEnrollment(jean.id, agile.id, null);
  await ensureEnrollment(marie.id, agile.id, null);
  await ensureEnrollment(emma.id, agile.id, null);

  // ══════════════════════════════════════════════════════════════════
  // PROGRESSIONS (variées, pour rendre vivants kanban et analytics)
  // ══════════════════════════════════════════════════════════════════
  // Jean : Python bien avancé + Agile entamé
  for (const l of [pyL1, pyL2, pyL3]) await ensureProgress(jean.id, l.id, { completed: true });
  await ensureProgress(jean.id, pyL4.id, { completed: false, lastPosition: 240 });
  await ensureProgress(jean.id, agL1.id, { completed: true });
  await ensureProgress(jean.id, agL2.id, { completed: true });
  await ensureProgress(jean.id, agL3.id, { completed: false, lastPosition: 60 });
  // Léa : démarre Python
  await ensureProgress(lea.id, pyL1.id, { completed: true });
  // Hugo : JavaScript bien avancé
  for (const l of [jsL1, jsL2, jsL3, jsL4]) await ensureProgress(hugo.id, l.id, { completed: true });
  await ensureProgress(hugo.id, jsL5.id, { completed: false, lastPosition: 90 });
  // Chloé : JavaScript terminé à 100 %
  for (const l of [jsL1, jsL2, jsL3, jsL4, jsL5, jsL6]) await ensureProgress(chloe.id, l.id, { completed: true });
  // Sophia : Communication aux deux tiers
  await ensureProgress(sophia.id, comL1.id, { completed: true });
  await ensureProgress(sophia.id, comL2.id, { completed: true });
  // Emma : Agile entamé
  await ensureProgress(emma.id, agL1.id, { completed: true });

  // ── Tentatives de quiz (meilleurs scores) ──────────────────────────
  await ensureAttempt(jean.id, pyL4.id, pyQuiz4.id, 2, 3);
  await ensureAttempt(lea.id, pyL4.id, pyQuiz4.id, 1, 3);
  await ensureAttempt(jean.id, agL2.id, agQuiz2.id, 2, 2);
  await ensureAttempt(hugo.id, jsL5.id, jsQuiz5.id, 1, 2);
  await ensureAttempt(chloe.id, jsL3.id, jsQuiz3.id, 2, 2);
  await ensureAttempt(chloe.id, jsL5.id, jsQuiz5.id, 2, 2);
  await ensureAttempt(sophia.id, comL2.id, comQuiz2.id, 1, 1);

  // ── Vague supplémentaire : ~20 apprenants au total, parcours variés ─
  const wave: Array<{ email: string; name: string }> = [
    { email: 'nathan@example.fr', name: 'Nathan Perrin' },
    { email: 'ines@example.fr', name: 'Inès Moreau' },
    { email: 'rayan@example.fr', name: 'Rayan Bencheikh' },
    { email: 'camille@example.fr', name: 'Camille Roussel' },
    { email: 'theo@example.fr', name: 'Théo Lambert' },
    { email: 'aicha@example.fr', name: 'Aïcha Diallo' },
    { email: 'maxime@example.fr', name: 'Maxime Dubreuil' },
    { email: 'jade@example.fr', name: 'Jade Renard' },
    { email: 'louis@example.fr', name: 'Louis Mercier' },
    { email: 'sarah@example.fr', name: 'Sarah Klein' },
    { email: 'yanis@example.fr', name: 'Yanis Aubert' },
    { email: 'manon@example.fr', name: 'Manon Leroy' },
  ];
  const waveUsers: Record<string, Awaited<ReturnType<typeof apprenant>>> = {};
  for (const l of wave) waveUsers[l.email] = await apprenant(l.email, l.name);
  const [nathan, ines, rayan, camille, theo, aicha, maxime, jade, louis, sarah, yanis, manon] =
    wave.map((l) => waveUsers[l.email]);

  const extraEnrollments: Array<{ user: { id: string }; formation: { id: string }; granter: string | null }> = [
    { user: nathan, formation: python, granter: claire.id },
    { user: theo, formation: python, granter: claire.id },
    { user: louis, formation: python, granter: marc.id },
    { user: rayan, formation: js, granter: marc.id },
    { user: yanis, formation: js, granter: claire.id },
    { user: maxime, formation: js, granter: marc.id },
    { user: ines, formation: com, granter: claire.id },
    { user: jade, formation: com, granter: claire.id },
    { user: manon, formation: com, granter: marc.id },
  ];
  for (const e of extraEnrollments) await ensureEnrollment(e.user.id, e.formation.id, e.granter);
  await ensureEnrollment(camille.id, agile.id, null);
  await ensureEnrollment(aicha.id, agile.id, null);
  await ensureEnrollment(sarah.id, agile.id, null);

  // Progressions de la vague : du « jamais commencé » au « terminé à 100 % »
  await ensureProgress(nathan.id, pyL1.id, { completed: true });
  await ensureProgress(nathan.id, pyL2.id, { completed: true });
  await ensureProgress(nathan.id, pyL3.id, { completed: false, lastPosition: 150 });
  for (const l of [comL1, comL2, comL3]) await ensureProgress(ines.id, l.id, { completed: true });
  for (const l of [jsL1, jsL2, jsL3]) await ensureProgress(rayan.id, l.id, { completed: true });
  await ensureProgress(rayan.id, jsL4.id, { completed: false, lastPosition: 45 });
  for (const l of [agL1, agL2, agL3, agL4]) await ensureProgress(aicha.id, l.id, { completed: true });
  await ensureProgress(jade.id, comL1.id, { completed: true });
  await ensureProgress(louis.id, pyL1.id, { completed: true });
  await ensureProgress(yanis.id, jsL1.id, { completed: true });
  // camille, theo, maxime, sarah, manon : inscrits sans progression (NOT_STARTED)

  const extraAttempts: Array<{ user: { id: string }; lesson: { id: string }; quiz: { id: string }; score: number; total: number }> = [
    { user: nathan, lesson: pyL4, quiz: pyQuiz4, score: 1, total: 3 },
    { user: ines, lesson: comL2, quiz: comQuiz2, score: 1, total: 1 },
    { user: aicha, lesson: agL2, quiz: agQuiz2, score: 2, total: 2 },
    { user: aicha, lesson: agL4, quiz: agQuiz4, score: 1, total: 1 },
    { user: rayan, lesson: jsL3, quiz: jsQuiz3, score: 1, total: 2 },
  ];
  for (const a of extraAttempts) await ensureAttempt(a.user.id, a.lesson.id, a.quiz.id, a.score, a.total);

  // ══════════════════════════════════════════════════════════════════
  // SESSIONS (présentielles + visio, passées et à venir)
  // ══════════════════════════════════════════════════════════════════
  async function ensureSession(data: {
    formationId: string;
    title: string;
    inDays: number;
    startHour: number;
    durationH: number;
    modality: 'PRESENTIEL' | 'ONLINE';
    location?: string;
    meetingUrl?: string;
    capacity: number;
    trainerId: string;
  }) {
    const startAt = new Date(Date.now() + data.inDays * 24 * 3600 * 1000);
    startAt.setHours(data.startHour, 0, 0, 0);
    const endAt = new Date(startAt.getTime() + data.durationH * 3600 * 1000);
    const existing = await prisma.session.findFirst({
      where: { formationId: data.formationId, title: data.title },
    });
    if (existing) return existing;
    return prisma.session.create({
      data: {
        formationId: data.formationId,
        title: data.title,
        startAt,
        endAt,
        modality: data.modality,
        location: data.location ?? null,
        meetingUrl: data.meetingUrl ?? null,
        capacity: data.capacity,
        trainerId: data.trainerId,
      },
    });
  }

  async function ensureParticipant(sessionId: string, userId: string, attended = false) {
    return prisma.sessionParticipant.upsert({
      where: { sessionId_userId: { sessionId, userId } },
      update: {},
      create: { sessionId, userId, attended },
    });
  }

  const webinaire = await ensureSession({
    formationId: python.id,
    title: 'Webinaire : bien démarrer avec Pandas',
    inDays: -14,
    startHour: 12,
    durationH: 1,
    modality: 'ONLINE',
    meetingUrl: 'https://meet.example.fr/pandas-intro',
    capacity: 30,
    trainerId: karim.id,
  });
  const reactLive = await ensureSession({
    formationId: js.id,
    title: 'Live coding : composants React — en ligne',
    inDays: 3,
    startHour: 10,
    durationH: 2,
    modality: 'ONLINE',
    meetingUrl: 'https://meet.example.fr/react-live',
    capacity: 12,
    trainerId: emilie.id,
  });
  const journeePy = await ensureSession({
    formationId: python.id,
    title: 'Journée intensive Python - Paris',
    inDays: 7,
    startHour: 9,
    durationH: 7,
    modality: 'PRESENTIEL',
    location: '24 avenue de la République, 75011 Paris - Salle B',
    capacity: 8,
    trainerId: karim.id,
  });
  const scrumLyon = await ensureSession({
    formationId: agile.id,
    title: 'Atelier Scrum - Lyon',
    inDays: 10,
    startHour: 14,
    durationH: 3,
    modality: 'PRESENTIEL',
    location: 'Le Voûte 1901, 12 quai Jules Courmont, 69002 Lyon',
    capacity: 12,
    trainerId: thomas.id,
  });

  await ensureParticipant(webinaire.id, jean.id, true);
  await ensureParticipant(webinaire.id, lea.id, false);
  await ensureParticipant(webinaire.id, aicha.id, true);
  await ensureParticipant(reactLive.id, hugo.id);
  await ensureParticipant(reactLive.id, chloe.id);
  await ensureParticipant(reactLive.id, rayan.id);
  await ensureParticipant(reactLive.id, yanis.id);
  await ensureParticipant(reactLive.id, maxime.id);
  await ensureParticipant(journeePy.id, jean.id);
  await ensureParticipant(journeePy.id, lea.id);
  await ensureParticipant(journeePy.id, nathan.id);
  await ensureParticipant(journeePy.id, theo.id);
  await ensureParticipant(journeePy.id, louis.id);
  await ensureParticipant(scrumLyon.id, marie.id);
  await ensureParticipant(scrumLyon.id, emma.id);
  await ensureParticipant(scrumLyon.id, camille.id);
  await ensureParticipant(scrumLyon.id, sarah.id);

  // ══════════════════════════════════════════════════════════════════
  // NOTIFICATIONS INTERNES (assignations de formations)
  // ══════════════════════════════════════════════════════════════════
  async function ensureNotification(
    userId: string,
    title: string,
    body: string,
    link: string,
    read: boolean
  ) {
    const existing = await prisma.notification.findFirst({ where: { userId, title } });
    if (existing) return existing;
    return prisma.notification.create({
      data: { userId, type: 'FORMATION_ASSIGNED', title, body, link, read },
    });
  }

  await ensureNotification(
    karim.id,
    'Nouvelle formation assignée : « Python pour la Data »',
    'Claire Dubois vous a confié cette formation. Construisez son contenu (sections, leçons, quiz) puis la gestion la publiera.',
    `/backoffice/formations/${python.id}`,
    true
  );
  await ensureNotification(
    karim.id,
    'Nouvelle formation assignée : « Cybersécurité : les essentiels »',
    'Marc Lefèvre vous a confié cette formation. Elle est encore en brouillon : terminez son contenu pour permettre sa publication.',
    `/backoffice/formations/${cyber.id}`,
    false
  );
  await ensureNotification(
    emilie.id,
    'Nouvelle formation assignée : « JavaScript Moderne & React »',
    'Claire Dubois vous a confié cette formation. Construisez son contenu (sections, leçons, quiz) puis la gestion la publiera.',
    `/backoffice/formations/${js.id}`,
    true
  );
  await ensureNotification(
    thomas.id,
    'Nouvelle formation assignée : « Gestion de projet Agile »',
    'Claire Dubois vous a confié cette formation. Construisez son contenu (sections, leçons, quiz) puis la gestion la publiera.',
    `/backoffice/formations/${agile.id}`,
    true
  );
  await ensureNotification(
    thomas.id,
    'Nouvelle formation assignée : « Communication Professionnelle »',
    'Claire Dubois vous a confié cette formation. Construisez son contenu (sections, leçons, quiz) puis la gestion la publiera.',
    `/backoffice/formations/${com.id}`,
    false
  );

  // ══════════════════════════════════════════════════════════════════
  console.log('✅ Seed terminé.');
  console.log('   Équipe        : admin@liteudemy.local / admin123');
  console.log('   Gestionnaires : gestion@liteudemy.local · marc@liteudemy.local / gestion123');
  console.log('   Formateurs    : formateur@ · emilie@ · thomas@liteudemy.local / formateur123');
  console.log('   Apprenants    : 20 comptes @example.fr / demo123');
  console.log('   Formations    : 4 publiées (2 payantes, 1 gratuite, 1 soft-skills) + 1 brouillon');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
