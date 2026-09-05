import 'dotenv/config';
import path from 'node:path';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/db/prisma';

// Whisper CPU inference runs inside these tests (~1s per short clip once the
// model is cached) — allow generous time for cold starts.
jest.setTimeout(300000);

const FIXTURES = path.resolve(__dirname, 'fixtures', 'audio');

async function elderToken(app: ReturnType<typeof createApp>): Promise<string> {
  const res = await request(app)
    .post('/api/v1/auth/dev-login')
    .send({ role: 'elder', phone_number_hash: `audio-test-${Date.now()}` });
  return res.body.token as string;
}

describe('POST /api/v1/detection/analyze-audio', () => {
  const app = createApp();
  let token: string;

  beforeAll(async () => {
    await prisma.$connect();
    token = await elderToken(app);
  });

  afterAll(async () => {
    // Only rows this suite created live in the isolated test database.
    await prisma.$disconnect();
  });

  function analyze(fixture: string) {
    return request(app)
      .post('/api/v1/detection/analyze-audio')
      .set('Authorization', `Bearer ${token}`)
      .attach('audio', path.join(FIXTURES, fixture));
  }

  it('scores a fake IRS threat high and cites payment, authority and secrecy signals', async () => {
    const res = await analyze('irs-scam.wav');

    expect(res.status).toBe(200);
    expect(res.body.risk_score).toBeGreaterThanOrEqual(60);
    expect(res.body.risk_reasons).toContain('payment_gift_card');
    expect(res.body.risk_reasons).toContain('authority_impersonation');
    expect(res.body.risk_reasons).toContain('secrecy_pressure');
    // Excerpts point at matched text; the full transcript never comes back.
    expect(res.body.matches.length).toBeGreaterThan(0);
    for (const match of res.body.matches) {
      expect(match.excerpt.length).toBeLessThan(200);
      expect(res.body).not.toHaveProperty('transcript');
    }
  });

  it('scores a fake grandchild-in-trouble call as risky via family + urgency + payment signals', async () => {
    const res = await analyze('grandchild-scam.wav');

    expect(res.status).toBe(200);
    expect(res.body.risk_score).toBeGreaterThanOrEqual(40);
    expect(res.body.risk_reasons).toContain('family_emergency');
    expect(res.body.risk_reasons).toContain('urgency_pressure');
  });

  it('handles mp3 uploads via host ffmpeg with the same result as wav', async () => {
    const res = await analyze('irs-scam.mp3');

    expect(res.status).toBe(200);
    expect(res.body.risk_score).toBeGreaterThanOrEqual(60);
    expect(res.body.risk_reasons).toEqual(
      expect.arrayContaining(['payment_gift_card', 'authority_impersonation']),
    );
  });

  it('handles m4a uploads via host ffmpeg', async () => {
    const res = await analyze('grandchild-scam.m4a');

    expect(res.status).toBe(200);
    expect(res.body.risk_score).toBeGreaterThanOrEqual(40);
    expect(res.body.risk_reasons).toContain('family_emergency');
  });

  it('keeps a benign pharmacy message near zero', async () => {
    const res = await analyze('benign-pharmacy.wav');

    expect(res.status).toBe(200);
    expect(res.body.risk_score).toBeLessThanOrEqual(20);
    expect(res.body.risk_reasons).not.toContain('payment_gift_card');
    expect(res.body.risk_reasons).not.toContain('authority_impersonation');
    expect(res.body.risk_reasons).not.toContain('family_emergency');
  });

  it('separates scam clips decisively from the benign control', async () => {
    const [irs, grandchild, benign] = await Promise.all([
      analyze('irs-scam.wav'),
      analyze('grandchild-scam.wav'),
      analyze('benign-pharmacy.wav'),
    ]);

    const benignScore = benign.body.risk_score;
    expect(irs.body.risk_score).toBeGreaterThan(benignScore * 3);
    expect(grandchild.body.risk_score).toBeGreaterThan(Math.max(benignScore * 2, benignScore + 15));
  });

  it('rejects requests without an audio file', async () => {
    const res = await request(app)
      .post('/api/v1/detection/analyze-audio')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ code: 'AUDIO_FILE_REQUIRED' });
  });

  it('rejects non-audio uploads by extension', async () => {
    const res = await request(app)
      .post('/api/v1/detection/analyze-audio')
      .set('Authorization', `Bearer ${token}`)
      .attach('audio', Buffer.from('definitely not audio'), 'notes.txt');

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ code: 'AUDIO_FORMAT_UNSUPPORTED' });
  });

  it('requires authentication', async () => {
    const res = await request(app)
      .post('/api/v1/detection/analyze-audio')
      .attach('audio', path.join(FIXTURES, 'benign-pharmacy.wav'));

    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ code: 'UNAUTHORIZED' });
  });
});