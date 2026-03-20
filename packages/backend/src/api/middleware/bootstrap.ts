import type { Request, Response, NextFunction } from 'express';

const EXEMPT_PREFIXES = ['/api/setup', '/api/config/import'];

export function createBootstrapMiddleware(getUserCount: () => number) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.path.startsWith('/api/')) { next(); return; }
    if (EXEMPT_PREFIXES.some(prefix => req.path.startsWith(prefix))) { next(); return; }
    if (getUserCount() > 0) { next(); return; }
    res.status(412).json({ error: 'setup_required' });
  };
}
