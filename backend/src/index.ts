import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { authRouter } from './routes/auth.js';
import { teamRouter } from './routes/team.js';
import { learnersRouter } from './routes/learners.js';
import { formationsRouter } from './routes/formations.js';
import { uploadsRouter, streamVideo } from './routes/uploads.js';
import { enrollmentsRouter } from './routes/enrollments.js';
import { sessionsRouter } from './routes/sessions.js';
import { meRouter } from './routes/me.js';
import { statsRouter } from './routes/stats.js';
import { catalogueRouter, enrollRouter } from './routes/catalogue.js';
import { quizStaffRouter, quizLearnerRouter } from './routes/quiz.js';
import { optionalAuth, requireAuth } from './lib/auth.js';

const app = express();
const PORT = Number(process.env.PORT || 4000);

app.use(
  cors({
    origin: [
      'http://localhost:3001',
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:3001',
      'http://[::1]:3000',
      'https://hoppscotch.io',
      'https://postman.co',
      'https://go.postman.co',
    ],
    credentials: true,
  })
);
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.use('/api/auth', authRouter);
app.use('/api/team', teamRouter);
app.use('/api/learners', learnersRouter);
app.use('/api/formations', formationsRouter);
app.use('/api/uploads', uploadsRouter);
app.use('/api/enrollments', enrollmentsRouter);
app.use('/api/sessions', sessionsRouter);
app.use('/api/me', meRouter);
app.use('/api/stats', statsRouter);
app.use('/api/staff/quiz', quizStaffRouter);
app.use('/api/me/quiz', quizLearnerRouter);
app.use('/api/catalogue', optionalAuth, catalogueRouter);
app.use('/api/me/enroll', requireAuth, enrollRouter);
app.get('/api/videos/:filename', optionalAuth, streamVideo);

// 404 JSON
app.use('/api', (_req, res) => res.status(404).json({ error: 'Route introuvable' }));

// Gestion d'erreurs centralisée
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Erreur serveur' });
});

app.listen(PORT, () => {
  console.log(`✅ Backend LoraOne démarré sur http://localhost:${PORT}`);
});
