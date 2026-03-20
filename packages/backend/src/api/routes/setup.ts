import { Router } from 'express';
import { hydrateUserDictionary, loadSeedCompanies } from '../../db/bootstrap.js';
import { loadFullTemplate } from '../../documents/dictionary.js';
import { extractTextFromPdf } from '../../documents/parser.js';
import { extractProfileData } from '../../documents/extractor.js';
import multer from 'multer';
import type { createQueries } from '../../db/queries.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf') cb(null, true);
    else cb(new Error('Only PDF files are accepted'));
  },
});

export function createSetupRouter(queries: ReturnType<typeof createQueries>) {
  const router = Router();

  // Step 1: Create user
  router.post('/user', (req, res, next) => {
    try {
      const { name, avatarColor } = req.body;
      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        res.status(400).json({ error: 'Name is required' });
        return;
      }
      const user = queries.insertUser({ name: name.trim(), avatarColor: avatarColor || '#6366f1' });
      res.status(201).json({ userId: user.id });
    } catch (err) { next(err); }
  });

  // Step 2: Choose archetype + create profile
  router.post('/archetype', (req, res, next) => {
    try {
      const { archetype, userId } = req.body;
      if (!archetype || !userId) {
        res.status(400).json({ error: 'archetype and userId required' });
        return;
      }
      const template = loadFullTemplate(archetype);
      const profile = queries.insertProfile({
        name: template.label || archetype,
        targetTitles: JSON.stringify(template.defaultTitles || []),
        targetSkills: JSON.stringify([]),
        targetCerts: null,
        targetLocations: null,
        searchQueries: null,
        titleSynonyms: JSON.stringify(template.defaultSynonyms || {}),
        excludeTitles: JSON.stringify(template.defaultExcludes || []),
        archetype,
        freshnessWeight: template.weights?.freshness ?? 0.25,
        skillWeight: template.weights?.skill ?? 0.25,
        titleWeight: template.weights?.title ?? 0.15,
        certWeight: template.weights?.cert ?? 0.10,
        competitionWeight: template.weights?.competition ?? 0.10,
        locationWeight: template.weights?.location ?? 0.10,
        experienceWeight: template.weights?.experience ?? 0.05,
        userId,
      });
      const termCount = hydrateUserDictionary(userId, archetype);
      res.status(201).json({ profileId: profile.id, template, termCount });
    } catch (err) { next(err); }
  });

  // Step 3: Upload documents
  router.post('/documents', upload.single('file'), async (req, res, next) => {
    try {
      const file = req.file;
      const type = req.body.type as string;
      const userId = parseInt(req.body.userId, 10);
      if (!file) { res.status(400).json({ error: 'No file uploaded' }); return; }
      if (!type || !['resume', 'linkedin'].includes(type)) {
        res.status(400).json({ error: 'Type must be "resume" or "linkedin"' }); return;
      }
      const rawText = await extractTextFromPdf(file.buffer);
      const extracted = extractProfileData(rawText);
      queries.deleteDocumentByTypeAndUser(type, userId);
      queries.insertDocument({
        type, filename: file.originalname, rawText,
        parsedSkills: JSON.stringify(extracted.skills),
        parsedTitles: JSON.stringify(extracted.titles),
        parsedCerts: JSON.stringify(extracted.certs),
        parsedExperienceYears: extracted.experienceYears,
        parsedLocations: JSON.stringify(extracted.locations),
        parsedIndustries: JSON.stringify(extracted.industries),
        parsedTools: JSON.stringify(extracted.tools),
        parsedEducation: extracted.education ? JSON.stringify(extracted.education) : null,
        userId,
      });
      const docs = queries.getDocumentsByTypeAndUser(type, userId);
      res.json({ documentId: docs[0]?.id, extracted });
    } catch (err) { next(err); }
  });

  // GET skills — fetch all dictionary terms for a user
  router.get('/skills', (req, res, next) => {
    try {
      const userId = parseInt(req.query.userId as string, 10) || (req as any).userId;
      const terms = queries.getDictionaryTermsByUser(userId);
      res.json({ terms });
    } catch (err) { next(err); }
  });

  // Step 4: Customize skills
  router.post('/skills', (req, res, next) => {
    try {
      const { userId, add, remove } = req.body;
      if (add) {
        for (const { category, term } of add) {
          queries.insertDictionaryTerm(userId, category, term, 'manual');
        }
      }
      if (remove) {
        for (const { category, term } of remove) {
          queries.deleteDictionaryTerm(userId, category, term);
        }
      }
      const totalTerms = queries.getDictionaryTermCount(userId);
      res.json({ totalTerms });
    } catch (err) { next(err); }
  });

  // Step 5+6: Profile (titles, synonyms, excludes, locations, remote)
  router.post('/profile', (req, res, next) => {
    try {
      const { profileId, targetTitles, titleSynonyms, excludeTitles, targetLocations, remotePreference, searchQueries } = req.body;
      let generatedQueries = searchQueries;
      if (!generatedQueries && targetTitles && titleSynonyms) {
        const querySet = new Set<string>(targetTitles);
        for (const syns of Object.values(titleSynonyms) as string[][]) {
          for (const syn of syns) querySet.add(syn);
        }
        generatedQueries = Array.from(querySet);
      }
      const updates: Record<string, any> = {};
      if (targetTitles) updates.targetTitles = JSON.stringify(targetTitles);
      if (titleSynonyms) updates.titleSynonyms = JSON.stringify(titleSynonyms);
      if (excludeTitles !== undefined) updates.excludeTitles = JSON.stringify(excludeTitles);
      if (targetLocations) updates.targetLocations = JSON.stringify(targetLocations);
      if (remotePreference !== undefined) updates.remotePreference = remotePreference;
      if (generatedQueries) updates.searchQueries = JSON.stringify(generatedQueries);
      queries.updateProfile(profileId, updates);
      res.json({ profileId, generatedQueries });
    } catch (err) { next(err); }
  });

  // Step 7: Load seed companies
  router.post('/companies', (_req, res, next) => {
    try {
      const inserted = loadSeedCompanies();
      const allCompanies = queries.getCompanies();
      res.json({ activeCount: allCompanies.filter((c: any) => c.active).length, totalCount: allCompanies.length, inserted });
    } catch (err) { next(err); }
  });

  // Step 8: Complete
  router.post('/complete', (_req, res) => {
    res.json({ success: true });
  });

  return router;
}
