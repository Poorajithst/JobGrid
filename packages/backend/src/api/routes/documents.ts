import { Router } from 'express';
import multer from 'multer';
import { extractTextFromPdf } from '../../documents/parser.js';
import { extractProfileData } from '../../documents/extractor.js';
import type { createQueries } from '../../db/queries.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are accepted'));
    }
  },
});

export function createDocumentsRouter(queries: ReturnType<typeof createQueries>) {
  const router = Router();

  // POST /api/documents/upload
  router.post('/upload', upload.single('file'), async (req, res, next) => {
    try {
      const file = req.file;
      const type = req.body.type as string;

      if (!file) {
        res.status(400).json({ error: 'No file uploaded' });
        return;
      }
      if (!type || !['resume', 'linkedin'].includes(type)) {
        res.status(400).json({ error: 'Type must be "resume" or "linkedin"' });
        return;
      }

      // Extract text from PDF
      const rawText = await extractTextFromPdf(file.buffer);

      // Extract structured data
      const profile = extractProfileData(rawText);

      // Delete existing document of same type for this user (re-upload replaces)
      queries.deleteDocumentByTypeAndUser(type, req.userId);

      // Insert new document
      queries.insertDocument({
        type,
        filename: file.originalname,
        rawText,
        parsedSkills: JSON.stringify(profile.skills),
        parsedTitles: JSON.stringify(profile.titles),
        parsedCerts: JSON.stringify(profile.certs),
        parsedExperienceYears: profile.experienceYears,
        parsedLocations: JSON.stringify(profile.locations),
        parsedIndustries: JSON.stringify(profile.industries),
        parsedTools: JSON.stringify(profile.tools),
        parsedEducation: profile.education ? JSON.stringify(profile.education) : null,
        userId: req.userId,
      });

      // Return the inserted document (matches GET /documents shape)
      const docs = queries.getDocumentsByTypeAndUser(type, req.userId);
      const inserted = docs[0];

      res.json(inserted);
    } catch (err) {
      next(err);
    }
  });

  // GET /api/documents
  router.get('/', (req, res) => {
    const docs = queries.getDocumentsByUser(req.userId);
    res.json(docs);
  });

  // DELETE /api/documents/:id
  router.delete('/:id', (req, res) => {
    queries.deleteDocument(parseInt(req.params.id, 10));
    res.json({ message: 'Document deleted' });
  });

  return router;
}
