import { Router } from 'express';
import type { createQueries } from '../../db/queries.js';

export function createUsersRouter(queries: ReturnType<typeof createQueries>) {
  const router = Router();

  // GET /api/users — list all users
  router.get('/', (_req, res) => {
    res.json(queries.getUsers());
  });

  // GET /api/users/:id — get single user
  router.get('/:id', (req, res) => {
    const user = queries.getUserById(parseInt(req.params.id, 10));
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.json(user);
  });

  // POST /api/users — create user
  router.post('/', (req, res, next) => {
    try {
      const { name, avatarColor } = req.body;
      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        res.status(400).json({ error: 'Name is required' });
        return;
      }
      const user = queries.insertUser({ name: name.trim(), avatarColor: avatarColor || '#6366f1' });
      res.status(201).json(user);
    } catch (err) {
      next(err);
    }
  });

  // PATCH /api/users/:id — update user
  router.patch('/:id', (req, res, next) => {
    try {
      const id = parseInt(req.params.id, 10);
      const existing = queries.getUserById(id);
      if (!existing) {
        res.status(404).json({ error: 'User not found' });
        return;
      }
      const updates: Record<string, string> = {};
      if (req.body.name) updates.name = req.body.name;
      if (req.body.avatarColor) updates.avatarColor = req.body.avatarColor;
      const user = queries.updateUser(id, updates);
      res.json(user);
    } catch (err) {
      next(err);
    }
  });

  // DELETE /api/users/:id — delete user with cascade
  router.delete('/:id', (req, res, next) => {
    try {
      const id = parseInt(req.params.id, 10);
      const existing = queries.getUserById(id);
      if (!existing) {
        res.status(404).json({ error: 'User not found' });
        return;
      }
      queries.deleteUser(id);
      res.json({ message: 'User and associated data deleted' });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
