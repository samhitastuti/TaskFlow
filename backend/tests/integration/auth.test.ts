import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { buildApp } from '../../src/app';

describe('Auth Integration', () => {
  let app: any;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  it('should return 401 for /me without token', async () => {
    const response = await request(app.server).get('/api/v1/auth/me');
    expect(response.status).toBe(401);
  });

  it('should return 404 for unknown routes', async () => {
    const response = await request(app.server).get('/api/v1/unknown');
    expect(response.status).toBe(404);
  });
});
