import { describe, it, expect, vi } from 'vitest';
import { createBootstrapMiddleware } from '../middleware/bootstrap.js';

describe('bootstrap middleware', () => {
  it('returns 412 when no users exist and path is /api/*', () => {
    const middleware = createBootstrapMiddleware(() => 0);
    const req = { path: '/api/jobs' } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;
    const next = vi.fn();
    middleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(412);
    expect(res.json).toHaveBeenCalledWith({ error: 'setup_required' });
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next() for /api/setup paths', () => {
    const middleware = createBootstrapMiddleware(() => 0);
    const req = { path: '/api/setup/user' } as any;
    const res = {} as any;
    const next = vi.fn();
    middleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('calls next() for /api/config/import paths', () => {
    const middleware = createBootstrapMiddleware(() => 0);
    const req = { path: '/api/config/import' } as any;
    const res = {} as any;
    const next = vi.fn();
    middleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('calls next() when users exist', () => {
    const middleware = createBootstrapMiddleware(() => 1);
    const req = { path: '/api/jobs' } as any;
    const res = {} as any;
    const next = vi.fn();
    middleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('calls next() for non-API paths', () => {
    const middleware = createBootstrapMiddleware(() => 0);
    const req = { path: '/index.html' } as any;
    const res = {} as any;
    const next = vi.fn();
    middleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});
