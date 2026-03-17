import { Router } from 'express';
import { AddCompanySchema, UpdateCompanySchema } from '../schemas.js';
import type { createQueries } from '../../db/queries.js';

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

  return router;
}
