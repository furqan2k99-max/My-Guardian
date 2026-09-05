import 'dotenv/config';
import { prisma } from '../src/db/prisma';
import request from 'supertest';
import { createApp } from '../src/app';

/** Requires a migrated PostgreSQL. */
describe('GET /health/ready', () => {
  const app = createApp();

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('reports ok when the database is reachable', async () => {
    const res = await request(app).get('/health/ready');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});
