import 'dotenv/config';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/db/prisma';

async function devLogin(app: ReturnType<typeof createApp>, role: 'elder' | 'guardian') {
  const hash = `detect-test-${role}-${Date.now()}`;
  const res = await request(app)
    .post('/api/v1/auth/dev-login')
    .send({ role, phone_number_hash: hash });
  return { token: res.body.token as string, user: res.body.user };
}

async function linkElderToGuardian(
  app: ReturnType<typeof createApp>,
  elderToken: string,
  guardianToken: string,
) {
  const invite = await request(app)
    .post('/api/v1/family-links/invite')
    .set('Authorization', `Bearer ${guardianToken}`);
  await request(app)
    .post('/api/v1/family-links/accept')
    .set('Authorization', `Bearer ${elderToken}`)
    .send({ invite_code: invite.body.invite_code });
}

describe('Detection', () => {
  const app = createApp();

  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.flaggedEvent.deleteMany();
    await prisma.reputationCache.deleteMany();
    await prisma.deviceToken.deleteMany();
    await prisma.familyLinkInvite.deleteMany();
    await prisma.familyLink.deleteMany();
    await prisma.user.deleteMany();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.flaggedEvent.deleteMany();
    await prisma.reputationCache.deleteMany();
    await prisma.deviceToken.deleteMany();
    await prisma.familyLinkInvite.deleteMany();
    await prisma.familyLink.deleteMany();
    await prisma.user.deleteMany();
  });

  describe('POST /api/v1/detection/scan-url', () => {
    it('returns a heuristic verdict (not null) when no external vendor is configured', async () => {
      const elder = await devLogin(app, 'elder');
      const res = await request(app)
        .post('/api/v1/detection/scan-url')
        .set('Authorization', `Bearer ${elder.token}`)
        .send({ url: 'https://example.com/suspicious' });

      expect(res.status).toBe(200);
      expect(res.body.identifier_hash).toMatch(/^[a-f0-9]{64}$/);
      expect(res.body.identifier_type).toBe('url');
      // With local heuristics enabled, we always return a numeric score,
      // never null. example.com is not in the allowlist and the path
      // contains "suspicious" — score will be ≥ 30.
      expect(typeof res.body.score).toBe('number');
      expect(res.body.score).toBeGreaterThanOrEqual(30);
      expect(res.body.source).toMatch(/^heuristic_/);
      expect(res.body.cached).toBe(false);
    });

    it('returns a low score for allowlisted domains even without a vendor', async () => {
      const elder = await devLogin(app, 'elder');
      const res = await request(app)
        .post('/api/v1/detection/scan-url')
        .set('Authorization', `Bearer ${elder.token}`)
        .send({ url: 'https://google.com/search' });

      expect(res.status).toBe(200);
      expect(res.body.score).toBeLessThanOrEqual(10);
      expect(res.body.source).toMatch(/^heuristic_allowlist/);
    });

    it('flags clearly malicious URLs (denylist) without a vendor', async () => {
      const elder = await devLogin(app, 'elder');
      const res = await request(app)
        .post('/api/v1/detection/scan-url')
        .set('Authorization', `Bearer ${elder.token}`)
        .send({ url: 'https://paypa1-secure.com/login' });

      expect(res.status).toBe(200);
      expect(res.body.score).toBeGreaterThanOrEqual(70);
      expect(res.body.source).toBe('heuristic_denylist');
    });

    it('serves repeated scans from the cache', async () => {
      const elder = await devLogin(app, 'elder');
      const url = 'https://example.com/cached-check';
      const scan = () =>
        request(app)
          .post('/api/v1/detection/scan-url')
          .set('Authorization', `Bearer ${elder.token}`)
          .send({ url });

      const first = await scan();
      const second = await scan();

      expect(first.body.identifier_hash).toBe(second.body.identifier_hash);
      expect(first.body.cached).toBe(false);
      expect(second.body.cached).toBe(true);
      expect(first.body.score).toBe(second.body.score);
    });

    it('rejects a malformed URL', async () => {
      const elder = await devLogin(app, 'elder');
      const res = await request(app)
        .post('/api/v1/detection/scan-url')
        .set('Authorization', `Bearer ${elder.token}`)
        .send({ url: 'not-a-url' });

      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({ code: 'VALIDATION_ERROR' });
    });
  });

  describe('events', () => {
    it('flags an event as the elder and makes it visible to linked guardians with an alert timestamp', async () => {
      const guardian = await devLogin(app, 'guardian');
      const elder = await devLogin(app, 'elder');
      await linkElderToGuardian(app, elder.token, guardian.token);

      const flag = await request(app)
        .post('/api/v1/events')
        .set('Authorization', `Bearer ${elder.token}`)
        .send({
          event_type: 'sms',
          sender_hash: 'deadbeef',
          risk_score: 87,
          risk_reasons: ['urgency_language', 'payment_request'],
        });
      expect(flag.status).toBe(200);
      expect(flag.body.event_type).toBe('sms');
      expect(flag.body.risk_score).toBe(87);
      expect(flag.body.risk_reasons).toEqual(['urgency_language', 'payment_request']);
      expect(flag.body.guardian_notified_at).toBeDefined();

      const asGuardian = await request(app)
        .get('/api/v1/events')
        .set('Authorization', `Bearer ${guardian.token}`);
      expect(asGuardian.status).toBe(200);
      expect(asGuardian.body).toHaveLength(1);
      expect(asGuardian.body[0].id).toBe(flag.body.id);

      const asElder = await request(app)
        .get('/api/v1/events')
        .set('Authorization', `Bearer ${elder.token}`);
      expect(asElder.body).toHaveLength(1);
      expect(asElder.body[0].elder_action).toBe('no_action');
    });

    it('lets the elder record their action on an event', async () => {
      const elder = await devLogin(app, 'elder');
      const flag = await request(app)
        .post('/api/v1/events')
        .set('Authorization', `Bearer ${elder.token}`)
        .send({ event_type: 'email', sender_hash: 'c0ffee', risk_reasons: [] });

      const update = await request(app)
        .patch(`/api/v1/events/${flag.body.id}/action`)
        .set('Authorization', `Bearer ${elder.token}`)
        .send({ elder_action: 'blocked' });

      expect(update.status).toBe(200);
      expect(update.body.elder_action).toBe('blocked');
    });

    it('flags a checked link as its own event type, visible to the guardian', async () => {
      const guardian = await devLogin(app, 'guardian');
      const elder = await devLogin(app, 'elder');
      await linkElderToGuardian(app, elder.token, guardian.token);

      const flag = await request(app)
        .post('/api/v1/events')
        .set('Authorization', `Bearer ${elder.token}`)
        .send({
          event_type: 'link',
          sender_hash: 'abc123',
          risk_score: 90,
          risk_reasons: ['url_scan_dangerous'],
        });
      expect(flag.status).toBe(200);
      expect(flag.body.event_type).toBe('link');
      expect(flag.body.risk_score).toBe(90);

      const asGuardian = await request(app)
        .get('/api/v1/events')
        .set('Authorization', `Bearer ${guardian.token}`);
      expect(asGuardian.status).toBe(200);
      expect(asGuardian.body[0].event_type).toBe('link');

      const single = await request(app)
        .get(`/api/v1/events/${flag.body.id}`)
        .set('Authorization', `Bearer ${guardian.token}`);
      expect(single.status).toBe(200);
      expect(single.body.elder_user).toBeDefined();
    });

    it('forbids a non-elder from flagging events', async () => {
      const guardian = await devLogin(app, 'guardian');
      const res = await request(app)
        .post('/api/v1/events')
        .set('Authorization', `Bearer ${guardian.token}`)
        .send({ event_type: 'sms', sender_hash: 'x', risk_reasons: [] });

      expect(res.status).toBe(403);
      expect(res.body).toMatchObject({ code: 'FORBIDDEN' });
    });
  });

  describe('guardian review (GET /events/:id, PATCH /events/:id/review)', () => {
    async function linkedPairWithEvent() {
      const guardian = await devLogin(app, 'guardian');
      const elder = await devLogin(app, 'elder');
      await linkElderToGuardian(app, elder.token, guardian.token);
      const flag = await request(app)
        .post('/api/v1/events')
        .set('Authorization', `Bearer ${elder.token}`)
        .send({ event_type: 'call', sender_hash: 'ca11bad', risk_reasons: ['reported_by_elder'] });
      return { guardian, elder, event: flag.body };
    }

    it('lets a linked guardian fetch one event and mark it reviewed', async () => {
      const { guardian, event } = await linkedPairWithEvent();

      const fetched = await request(app)
        .get(`/api/v1/events/${event.id}`)
        .set('Authorization', `Bearer ${guardian.token}`);
      expect(fetched.status).toBe(200);
      expect(fetched.body.id).toBe(event.id);
      expect(fetched.body.elder_user).toBeDefined();
      expect(fetched.body.guardian_action).toBeNull();

      const reviewed = await request(app)
        .patch(`/api/v1/events/${event.id}/review`)
        .set('Authorization', `Bearer ${guardian.token}`)
        .send({ action: 'reviewed' });

      expect(reviewed.status).toBe(200);
      expect(reviewed.body.guardian_action).toBe('reviewed');
      expect(reviewed.body.guardian_reviewed_at).toBeDefined();
    });

    it('lets the guardian dismiss instead', async () => {
      const { guardian, event } = await linkedPairWithEvent();

      const res = await request(app)
        .patch(`/api/v1/events/${event.id}/review`)
        .set('Authorization', `Bearer ${guardian.token}`)
        .send({ action: 'dismissed' });

      expect(res.status).toBe(200);
      expect(res.body.guardian_action).toBe('dismissed');
    });

    it('hides events from guardians without an active link to that elder', async () => {
      const { event } = await linkedPairWithEvent();
      const stranger = await devLogin(app, 'guardian');

      const fetched = await request(app)
        .get(`/api/v1/events/${event.id}`)
        .set('Authorization', `Bearer ${stranger.token}`);
      expect(fetched.status).toBe(404);

      const review = await request(app)
        .patch(`/api/v1/events/${event.id}/review`)
        .set('Authorization', `Bearer ${stranger.token}`)
        .send({ action: 'reviewed' });
      expect(review.status).toBe(404);
    });

    it('rejects an invalid review action with the validation shape', async () => {
      const { guardian, event } = await linkedPairWithEvent();

      const res = await request(app)
        .patch(`/api/v1/events/${event.id}/review`)
        .set('Authorization', `Bearer ${guardian.token}`)
        .send({ action: 'deleted' });

      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({ code: 'VALIDATION_ERROR' });
    });
  });
});
