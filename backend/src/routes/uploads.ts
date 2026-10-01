import fs from 'node:fs';
import path from 'node:path';
import express, { Router } from 'express';
import multer from 'multer';
import { prisma } from '../lib/prisma.js';
import { requireAuth, requireEquipe, isEquipe } from '../lib/auth.js';

const UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'videos');
const IMAGE_DIR = path.join(process.cwd(), 'uploads', 'images');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
fs.mkdirSync(IMAGE_DIR, { recursive: true });

const ALLOWED_MIMES: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.m4v': 'video/mp4',
  '.webm': 'video/webm',
  '.ogv': 'video/ogg',
  '.mov': 'video/quicktime',
};

const ALLOWED_IMAGES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
};

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const base = path
      .basename(file.originalname, ext)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .slice(0, 40);
    cb(null, `${Date.now()}-${base}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_MIMES[ext]) return cb(null, true);
    cb(new Error('Format vidéo non supporté (mp4, webm, mov, ogv)'));
  },
});

const imageStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, IMAGE_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const base = path
      .basename(file.originalname, ext)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .slice(0, 40);
    cb(null, `${Date.now()}-${base}${ext}`);
  },
});

const uploadImage = multer({
  storage: imageStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_IMAGES[ext]) return cb(null, true);
    cb(new Error('Format image non supporté (jpg, png, webp, gif, svg)'));
  },
});

export const uploadsRouter = Router();

// Upload d'une vidéo (équipe)
uploadsRouter.post(
  '/video',
  requireAuth,
  requireEquipe,
  upload.single('video'),
  (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Aucun fichier reçu' });
    const url = `/api/videos/${req.file.filename}`;
    res.status(201).json({ url, filename: req.file.filename, size: req.file.size });
  }
);

// Upload d'une image de leçon (équipe)
uploadsRouter.post(
  '/image',
  requireAuth,
  requireEquipe,
  uploadImage.single('image'),
  (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Aucun fichier reçu' });
    res.status(201).json({ url: `/api/images/${req.file.filename}` });
  }
);

// Service des images (public : les images de cours ne sont pas sensibles)
uploadsRouter.use('/images/:filename', (req, res) => {
  const filename = path.basename(String((req.params.filename as string)));
  const filePath = path.join(IMAGE_DIR, filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Image introuvable' });
  const mime = ALLOWED_IMAGES[path.extname(filename).toLowerCase()] || 'application/octet-stream';
  res.setHeader('Content-Type', mime);
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  fs.createReadStream(filePath).pipe(res);
});

// Erreurs multer (format refusé, fichier trop gros…)
uploadsRouter.use(
  (err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Upload échoué' });
  }
);

// Streaming avec support HTTP Range + protection par accès
export async function streamVideo(req: import('express').Request, res: import('express').Response) {
  const filename = path.basename(String((req.params.filename as string)));
  const filePath = path.join(UPLOAD_DIR, filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Vidéo introuvable' });

  // ── Autorisation : staff OK ; sinon leçon must be preview ou accès actif
  if (!isEquipe(req.user?.role ?? '')) {
    const lesson = await prisma.lesson.findFirst({ where: { videoPath: { contains: filename } } });
    if (!lesson) return res.status(404).json({ error: 'Vidéo introuvable' });
    if (req.user) {
      const section = await prisma.section.findUnique({ where: { id: lesson.sectionId } });
      if (!section) return res.status(404).json({ error: 'Vidéo introuvable' });
      const hasAccess =
        lesson.isPreview ||
        (await prisma.enrollment.findUnique({
          where: { userId_formationId: { userId: req.user.id, formationId: section.formationId } },
        }));
      if (!hasAccess) return res.status(403).json({ error: 'Accès non autorisé à cette formation' });
    } else if (!lesson.isPreview) {
      return res.status(401).json({ error: 'Connexion requise' });
    }
  }

  const size = fs.statSync(filePath).size;
  const mime = ALLOWED_MIMES[path.extname(filename).toLowerCase()] || 'application/octet-stream';
  const CHUNK = 1 * 1024 * 1024; // 1 Mo par requête

  const rangeHeader = req.headers.range;
  const range = typeof rangeHeader === 'string' ? rangeHeader : undefined;
  if (range) {
    const match = range.match(/bytes=(\d*)-(\d*)/);
    let start = match?.[1] ? parseInt(match[1], 10) : 0;
    let end = match?.[2] ? parseInt(match[2], 10) : Math.min(start + CHUNK - 1, size - 1);
    if (start >= size) {
      res.writeHead(416, { 'Content-Range': `bytes */${size}` });
      return res.end();
    }
    end = Math.min(end, size - 1);
    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${size}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': end - start + 1,
      'Content-Type': mime,
    });
    fs.createReadStream(filePath, { start, end }).pipe(res);
  } else {
    res.writeHead(200, {
      'Content-Length': size,
      'Content-Type': mime,
      'Accept-Ranges': 'bytes',
    });
    fs.createReadStream(filePath).pipe(res);
  }
}
