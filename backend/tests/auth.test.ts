import 'dotenv/config';
import { createHash } from 'node:crypto';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/db/prisma';
import { verifyFirebaseIdToken } from '../src/providers/firebaseAuth';

jest.mock('../src/providers/firebaseAuth', () => ({
  verifyFirebaseIdToken: jest.fn().mockRejectedValue(new Error('not a firebase token')),
}));

const mockVerify = verifyFirebaseIdToken as jest.Mock;

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

describe('Auth', () => {
  const app = createApp();
  const EMAIL = 'guardian.test@example.com';

  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.familyLink.deleteMany();
    await prisma.user.deleteMany();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.familyLink.deleteMany();
    await prisma.user.deleteMany();
  });

  describe('POST /api/v1/auth/dev-login', () => {
    it('mints a token and creates a user for a guardian', async () => {
      const res = await request(app)
        .post('/api/v1/auth/dev-login')
        .send({ role: 'guardian', phone_number_hash: 'auth-test-guardian-1' });

      expect(res.status).toBe(200);
      expect(res.body.token).toEqual(expect.any(String));
      expect(res.body.user.role).toBe('guardian');
      expect(res.body.user.phone_number_hash).toBe('auth-test-guardian-1');
      expect(res.body.user.created_at).toBeDefined();
    });

    it('is idempotent for the same role + hash', async () => {
      const body = { role: 'elder', phone_number_hash: 'auth-test-elder-1' };
      const first = await request(app).post('/api/v1/auth/dev-login').send(body);
      const second = await request(app).post('/api/v1/auth/dev-login').send(body);

      expect(first.body.user.id).toBe(second.body.user.id);
      const count = await prisma.user.count({
        where: { role: 'elder', phone_number_hash: 'auth-test-elder-1' },
      });
      expect(count).toBe(1);
    });

    it('rejects an invalid body with the standard error shape', async () => {
      const res = await request(app)
        .post('/api/v1/auth/dev-login')
        .send({ role: 'admin', phone_number_hash: 'short' });

      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({
        error: expect.any(String),
        code: 'VALIDATION_ERROR',
        requestId: expect.any(String),
      });
    });
  });

  describe('POST /api/v1/auth/firebase-login', () => {
    beforeEach(() => {
      mockVerify.mockReset();
      mockVerify.mockRejectedValue(new Error('not a firebase token'));
    });

    it('creates a guardian keyed by the server-side hash of the verified email', async () => {
      mockVerify.mockResolvedValue({ uid: 'fb-uid-1', email: EMAIL });

      const res = await request(app)
        .post('/api/v1/auth/firebase-login')
        .send({ role: 'guardian', id_token: 'real-firebase-token' });

      expect(res.status).toBe(200);
      expect(res.body.token).toEqual(expect.any(String));
      expect(res.body.user.role).toBe('guardian');
      expect(res.body.user.phone_number_hash).toBe(sha256(EMAIL.toLowerCase()));
      expect(mockVerify).toHaveBeenCalledWith('real-firebase-token');
    });

    it('matches an existing row for the same role + verified email (idempotent)', async () => {
      mockVerify.mockResolvedValue({ uid: 'fb-uid-2', email: EMAIL });
      const body = { role: 'elder', id_token: 'real-firebase-token' };

      const first = await request(app).post('/api/v1/auth/firebase-login').send(body);
      const second = await request(app).post('/api/v1/auth/firebase-login').send(body);

      expect(first.body.user.id).toBe(second.body.user.id);
      const count = await prisma.user.count({
        where: { role: 'elder', phone_number_hash: sha256(EMAIL.toLowerCase()) },
      });
      expect(count).toBe(1);
    });

    it('rejects a token with no verified email', async () => {
      mockVerify.mockResolvedValue({ uid: 'fb-uid-3', email: null });
      const res = await request(app)
        .post('/api/v1/auth/firebase-login')
        .send({ role: 'guardian', id_token: 'anonymous-token' });

      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({ code: 'INVALID_TOKEN' });
    });

    it('rejects an unverifiable token', async () => {
      const res = await request(app)
        .post('/api/v1/auth/firebase-login')
        .send({ role: 'guardian', id_token: 'forged' });

      expect(res.status).toBe(401);
      expect(res.body).toMatchObject({ code: 'INVALID_TOKEN' });
    });

    it('rejects a missing id_token with the standard validation shape', async () => {
      const res = await request(app)
        .post('/api/v1/auth/firebase-login')
        .send({ role: 'guardian' });

      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({ code: 'VALIDATION_ERROR' });
    });
  });

  describe('protected routes', () => {
    it('rejects requests without a bearer token', async () => {
      const res = await request(app).get('/api/v1/family-links');
      expect(res.status).toBe(401);
      expect(res.body).toMatchObject({ code: 'UNAUTHORIZED' });
    });

    it('rejects a token signed with the wrong secret', async () => {
      const forged = jwt.sign({ role: 'guardian', type: 'access' }, 'wrong-secret', {
        subject: 'any-user',
        expiresIn: '1h',
      });
      const res = await request(app)
        .get('/api/v1/family-links')
        .set('Authorization', `Bearer ${forged}`);

      expect(res.status).toBe(401);
      expect(res.body).toMatchObject({ code: 'INVALID_TOKEN' });
    });

    it('accepts a genuine Firebase ID token for an existing user', async () => {
      await prisma.user.create({
        data: { role: 'guardian', phone_number_hash: sha256(EMAIL.toLowerCase()) },
      });
      mockVerify.mockResolvedValue({ uid: 'fb-uid-4', email: EMAIL });

      const res = await request(app)
        .get('/api/v1/family-links')
        .set('Authorization', 'Bearer genuine-firebase-id-token');

      expect(res.status).toBe(200);
      expect(res.body).toEqual(expect.any(Array));
    });
  });
});
