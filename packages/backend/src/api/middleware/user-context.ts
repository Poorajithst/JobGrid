import type { Request, Response, NextFunction } from 'express';

declare global {
  namespace Express {
    interface Request {
      userId: number;
    }
  }
}

export function userContext(req: Request, _res: Response, next: NextFunction) {
  const fromHeader = req.headers['x-user-id'];
  const fromQuery = req.query.userId;
  const raw = String(fromHeader || fromQuery || '1');
  const parsed = parseInt(raw, 10);
  req.userId = Number.isNaN(parsed) ? 1 : parsed;
  next();
}
