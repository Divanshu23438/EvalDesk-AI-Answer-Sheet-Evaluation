import 'dotenv/config';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import multer from 'multer';
import { evaluateSheetPipeline, ServiceHttpError, type ExtractedQuestion } from './src/server/evaluateSheetService.ts';

interface ServerOcrAuditEntry {
  id: string;
  fileName: string;
  subjectLabel?: string;
  timestamp: string;
  engine: 'gemini' | 'groq';
  engineLabel: string;
  model: string;
  confidenceScore: number;
  confidence: 'high' | 'medium' | 'low';
  questionCount: number;
  fallbackTriggered: boolean;
  fallbackReason?: string | null;
  evaluatedWithRubric: boolean;
  durationMs: number;
}

const serverOcrAuditHistory: ServerOcrAuditEntry[] = [];

function computeServerConfidence(questions: ExtractedQuestion[]): {
  confidenceScore: number;
  confidence: 'high' | 'medium' | 'low';
} {
  if (questions.length === 0) {
    return { confidenceScore: 0, confidence: 'low' };
  }
  const total = questions.reduce((sum, q) => {
    if (q.confidence === 'high') return sum + 95;
    if (q.confidence === 'low') return sum + 45;
    return sum + 75;
  }, 0);
  const confidenceScore = Math.round(total / questions.length);
  const confidence: 'high' | 'medium' | 'low' =
    confidenceScore >= 85 ? 'high' : confidenceScore >= 65 ? 'medium' : 'low';
  return { confidenceScore, confidence };
}

const PORT = Number(process.env.PORT) || 3000;
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'application/pdf',
]);

function resolveMimeType(file: Express.Multer.File): string | null {
  const lowerMime = (file.mimetype || '').toLowerCase();
  if (ALLOWED_MIME_TYPES.has(lowerMime)) {
    return lowerMime === 'image/jpg' ? 'image/jpeg' : lowerMime;
  }
  const ext = path.extname(file.originalname || '').toLowerCase();
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.pdf') return 'application/pdf';
  return null;
}

function parseDataUrlPayload(dataUrl: string): { mimeType: string; buffer: Buffer } | null {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  const mime = match[1].toLowerCase() === 'image/jpg' ? 'image/jpeg' : match[1].toLowerCase();
  if (!ALLOWED_MIME_TYPES.has(mime)) return null;
  return {
    mimeType: mime,
    buffer: Buffer.from(match[2], 'base64'),
  };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '25mb' }));

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 20 * 1024 * 1024 },
  });

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.get('/api/ocr-audit', (_req, res) => {
    res.json({ records: serverOcrAuditHistory });
  });

  app.post('/api/evaluate-sheet', upload.single('file'), async (req, res) => {
    const startedAt = Date.now();
    try {
      let fileBuffer: Buffer | undefined;
      let mimeType: string | null = null;
      let fileName = 'sheet.jpg';

      if (req.file) {
        mimeType = resolveMimeType(req.file);
        fileBuffer = req.file.buffer;
        fileName = req.file.originalname || fileName;
      } else if (typeof req.body?.fileDataUrl === 'string') {
        const parsed = parseDataUrlPayload(req.body.fileDataUrl);
        if (parsed) {
          mimeType = parsed.mimeType;
          fileBuffer = parsed.buffer;
          fileName = typeof req.body.fileName === 'string' ? req.body.fileName : fileName;
        }
      }

      if (!fileBuffer || !mimeType) {
        res.status(400).json({
          error: 'Please upload a valid answer sheet file (JPG, PNG, WEBP, or PDF).',
        });
        return;
      }

      const rawForce = req.body?.forceFallback;
      const forceFallback =
        rawForce === true || rawForce === 'true' || rawForce === '1' || rawForce === 'on';
      const rubric = typeof req.body?.rubric === 'string' ? req.body.rubric : '';
      const subject = typeof req.body?.subject === 'string' ? req.body.subject : '';

      const result = await evaluateSheetPipeline({
        fileBuffer,
        mimeType,
        fileName,
        rubric,
        subject,
        forceFallback,
      });

      const durationMs = Math.max(1, Date.now() - startedAt);
      const { confidenceScore, confidence } = computeServerConfidence(result.questions);
      serverOcrAuditHistory.unshift({
        id: `srv-ocr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        fileName,
        subjectLabel: subject.trim() || undefined,
        timestamp: new Date().toISOString(),
        engine: result.engine,
        engineLabel: result.engineLabel,
        model: result.model,
        confidenceScore,
        confidence,
        questionCount: result.questions.length,
        fallbackTriggered: result.fallbackTriggered,
        fallbackReason: result.fallbackReason,
        evaluatedWithRubric: result.evaluatedWithRubric,
        durationMs,
      });
      if (serverOcrAuditHistory.length > 200) {
        serverOcrAuditHistory.length = 200;
      }

      res.json(result);
    } catch (err) {
      if (err instanceof ServiceHttpError) {
        res.status(err.status).json({ error: err.message });
        return;
      }
      const message = err instanceof Error ? err.message : 'Unexpected server OCR failure.';
      res.status(500).json({ error: message });
    }
  });

  // Handle Multer errors cleanly as JSON
  app.use((err: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (err && typeof err === 'object' && 'code' in err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : 'File upload failed.',
      });
      return;
    }
    next(err);
  });

  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      const indexHtml = path.join(distDir, 'index.html');
      if (fs.existsSync(indexHtml)) {
        res.sendFile(indexHtml);
      } else {
        res.status(404).send('Build output not found. Run npm run build first.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`EvalDesk server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
