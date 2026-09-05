import 'dotenv/config';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/db/prisma';

const APP = createApp();

async function devLogin(role: 'elder' | 'guardian') {
  const hash = `push-test-${role}-${Date.now()}`;
  const res = await request(APP)
    .post('/api/v1/auth/dev-login')
    .send({ role, phone_number_hash: hash });
  return { token: res.body.token as string, user: res.body.user };
}

describe('Push tokens', () => {
  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.flaggedEvent.deleteMany();
    await prisma.deviceToken.deleteMany();
    await prisma.familyLinkInvite.deleteMany();
    await prisma.familyLink.deleteMany();
    await prisma.user.deleteMany();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.flaggedEvent.deleteMany();
    await prisma.deviceToken.deleteMany();
    await prisma.familyLinkInvite.deleteMany();
    await prisma.familyLink.deleteMany();
    await prisma.user.deleteMany();
  });

  it('requires authentication', async () => {
    const res = await request(APP).post('/api/v1/push/tokens').send({
      token: 'device-abc',
      platform: 'android',
    });
    expect(res.status).toBe(401);
  });

  it('registers a token, and re-registering it is an upsert (one row)', async () => {
    const guardian = await devLogin('guardian');
    for (const _ of [1, 2]) {
      const res = await request(APP)
        .post('/api/v1/push/tokens')
        .set('Authorization', `Bearer ${guardian.token}`)
        .send({ token: 'device-123', platform: 'android' });
      expect(res.status).toBe(201);
    }
    const count = await prisma.deviceToken.count();
    expect(count).toBe(1);
  });

  it('rejects an unknown platform', async () => {
    const guardian = await devLogin('guardian');
    const res = await request(APP)
      .post('/api/v1/push/tokens')
      .set('Authorization', `Bearer ${guardian.token}`)
      .send({ token: 'device-xyz', platform: 'desktop' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('lists only the caller’s tokens and unregisters them on DELETE', async () => {
    const guardian = await devLogin('guardian');
    await request(APP)
      .post('/api/v1/push/tokens')
      .set('Authorization', `Bearer ${guardian.token}`)
      .send({ token: 'device-a', platform: 'android' });
    await request(APP)
      .post('/api/v1/push/tokens')
      .set('Authorization', `Bearer ${guardian.token}`)
      .send({ token: 'device-b', platform: 'ios' });

    const listed = await request(APP)
      .get('/api/v1/push/tokens')
      .set('Authorization', `Bearer ${guardian.token}`);
    expect(listed.status).toBe(200);
    expect(listed.body).toHaveLength(2);

    await request(APP)
      .delete('/api/v1/push/tokens/device-a')
      .set('Authorization', `Bearer ${guardian.token}`);
    const after = await request(APP)
      .get('/api/v1/push/tokens')
      .set('Authorization', `Bearer ${guardian.token}`);
    expect(after.body).toHaveLength(1);
    expect(after.body[0].token).toBe('device-b');
  });

  it('an event flag with no FCM credentials is skipped but still succeeds', async () => {
    const guardian = await devLogin('guardian');
    const elder = await devLogin('elder');

    await request(APP)
      .post('/api/v1/push/tokens')
      .set('Authorization', `Bearer ${guardian.token}`)
      .send({ token: 'device-push', platform: 'android' });

    const invite = await request(APP)
      .post('/api/v1/family-links/invite')
      .set('Authorization', `Bearer ${guardian.token}`);
    await request(APP)
      .post('/api/v1/family-links/accept')
      .set('Authorization', `Bearer ${elder.token}`)
      .send({ invite_code: invite.body.invite_code });

    const flagged = await request(APP)
      .post('/api/v1/events')
      .set('Authorization', `Bearer ${elder.token}`)
      .send({
        event_type: 'sms',
        sender_hash: 'p+1234abcd',
        risk_score: 88,
        risk_reasons: ['sms-known-scam'],
      });
    expect(flagged.status).toBe(200);
    expect(flagged.body.guardian_notified_at).not.toBeNull();
  });
});