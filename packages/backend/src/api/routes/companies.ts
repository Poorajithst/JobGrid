import { Router } from 'express';
import { AddCompanySchema, UpdateCompanySchema } from '../schemas.js';
import type { createQueries } from '../../db/queries.js';
import { probeCompany, discoverCompaniesViaAi } from '../../sources/discovery.js';

export function createCompaniesRouter(queries: ReturnType<typeof createQueries>) {
  const router = Router();

  router.get('/', (_req, res) => {
    res.json(queries.getCompanies());
  });

  router.post('/', (req, res, next) => {
    try {
      const parsed = AddCompanySchema.parse(req.body);
      queries.insertCompany(parsed);
      res.status(201).json({ message: 'Company added' });
    } catch (err) {
      next(err);
    }
  });

  router.patch('/:id', (req, res, next) => {
    try {
      const parsed = UpdateCompanySchema.parse(req.body);
      queries.updateCompany(parseInt(req.params.id, 10), parsed);
      res.json({ message: 'Company updated' });
    } catch (err) {
      next(err);
    }
  });

  router.delete('/:id', (req, res) => {
    queries.deleteCompany(parseInt(req.params.id, 10));
    res.json({ message: 'Company deleted' });
  });

  // POST /api/companies/discover — manual trigger, returns candidates for review
  router.post('/discover', async (req, res, next) => {
    try {
      // Log discovery run
      const run = queries.createDiscoveryRun({ startedAt: new Date().toISOString(), status: 'running', source: 'manual' });

      const profiles = queries.getActiveProfiles();
      if (profiles.length === 0) {
        queries.updateDiscoveryRun(run.id, { finishedAt: new Date().toISOString(), status: 'failed', error: 'No active profiles' });
        res.status(400).json({ error: 'No active profiles' });
        return;
      }
      const profile = profiles[0];
      const targetTitles = JSON.parse(profile.targetTitles);
      const targetLocations = profile.targetLocations ? JSON.parse(profile.targetLocations) : [];
      const existingCompanies = queries.getCompanies().map((c: any) => c.name);

      const suggestions = await discoverCompaniesViaAi(targetTitles, targetLocations, existingCompanies);
      const candidates = [];
      for (const s of suggestions) {
        const slugs = await probeCompany(s.name);
        if (slugs.greenhouse || slugs.lever || slugs.ashby) {
          candidates.push({ ...s, ...slugs });
        }
      }

      queries.updateDiscoveryRun(run.id, {
        finishedAt: new Date().toISOString(),
        companiesFound: suggestions.length,
        companiesNew: candidates.length,
        status: 'completed',
      });

      res.json({ companies: candidates });
    } catch (err) { next(err); }
  });

  // POST /api/companies/discover/confirm — insert confirmed companies
  router.post('/discover/confirm', (req, res, next) => {
    try {
      const { companies: newCompanies } = req.body;
      let inserted = 0;
      for (const c of newCompanies) {
        queries.insertCompany({
          name: c.name,
          greenhouseSlug: c.greenhouse || null,
          leverSlug: c.lever || null,
          ashbySlug: c.ashby || null,
          source: 'discovered',
        });
        inserted++;
      }
      res.json({ inserted });
    } catch (err) { next(err); }
  });

  return router;
}
