import 'dotenv/config';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/db/prisma';

async function devLogin(app: ReturnType<typeof createApp>, role: 'elder' | 'guardian') {
  const hash = `family-test-${role}-${Date.now()}`;
  const res = await request(app)
    .post('/api/v1/auth/dev-login')
    .send({ role, phone_number_hash: hash });
  return { token: res.body.token as string, user: res.body.user };
}

describe('Family linking', () => {
  const app = createApp();

  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.familyLinkInvite.deleteMany();
    await prisma.deviceToken.deleteMany();
    await prisma.familyLink.deleteMany();
    await prisma.user.deleteMany();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.familyLinkInvite.deleteMany();
    await prisma.deviceToken.deleteMany();
    await prisma.familyLink.deleteMany();
    await prisma.user.deleteMany();
  });

  it('guardian creates an invite, elder accepts it, link becomes active', async () => {
    const guardian = await devLogin(app, 'guardian');
    const elder = await devLogin(app, 'elder');

    const invite = await request(app)
      .post('/api/v1/family-links/invite')
      .set('Authorization', `Bearer ${guardian.token}`);
    expect(invite.status).toBe(200);
    expect(invite.body.invite_code).toMatch(/^[A-Z0-9]{6}$/);

    const accepted = await request(app)
      .post('/api/v1/family-links/accept')
      .set('Authorization', `Bearer ${elder.token}`)
      .send({ invite_code: invite.body.invite_code });
    expect(accepted.status).toBe(200);
    expect(accepted.body.status).toBe('active');
    expect(accepted.body.elder_user_id).toBe(elder.user.id);
    expect(accepted.body.guardian_user_id).toBe(guardian.user.id);
  });

  it('accepting the same invite again is idempotent', async () => {
    const guardian = await devLogin(app, 'guardian');
    const elder = await devLogin(app, 'elder');

    const invite = await request(app)
      .post('/api/v1/family-links/invite')
      .set('Authorization', `Bearer ${guardian.token}`);
    const code = invite.body.invite_code;

    const first = await request(app)
      .post('/api/v1/family-links/accept')
      .set('Authorization', `Bearer ${elder.token}`)
      .send({ invite_code: code });
    const second = await request(app)
      .post('/api/v1/family-links/accept')
      .set('Authorization', `Bearer ${elder.token}`)
      .send({ invite_code: code });

    expect(first.body.id).toBe(second.body.id);
    const count = await prisma.familyLink.count();
    expect(count).toBe(1);
  });

  it('accepts any casing/whitespace in the code', async () => {
    const guardian = await devLogin(app, 'guardian');
    const elder = await devLogin(app, 'elder');

    const invite = await request(app)
      .post('/api/v1/family-links/invite')
      .set('Authorization', `Bearer ${guardian.token}`);
    const code = invite.body.invite_code as string;

    const res = await request(app)
      .post('/api/v1/family-links/accept')
      .set('Authorization', `Bearer ${elder.token}`)
      .send({ invite_code: `  ${code.toLowerCase()}  ` });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('active');
  });

  it('rejects an expired invite code', async () => {
    const guardian = await devLogin(app, 'guardian');
    const elder = await devLogin(app, 'elder');

    const invite = await request(app)
      .post('/api/v1/family-links/invite')
      .set('Authorization', `Bearer ${guardian.token}`);
    const code = invite.body.invite_code as string;

    await prisma.familyLinkInvite.update({
      where: { code },
      data: { expires_at: new Date(Date.now() - 1000) },
    });

    const expired = await request(app)
      .post('/api/v1/family-links/accept')
      .set('Authorization', `Bearer ${elder.token}`)
      .send({ invite_code: code });
    expect(expired.status).toBe(400);
    expect(expired.body).toMatchObject({ code: 'INVALID_INVITE_CODE' });
  });

  it('a fresh invite code is stored with a server-side expiry', async () => {
    const guardian = await devLogin(app, 'guardian');
    const invite = await request(app)
      .post('/api/v1/family-links/invite')
      .set('Authorization', `Bearer ${guardian.token}`);
    const stored = await prisma.familyLinkInvite.findUnique({
      where: { code: invite.body.invite_code },
    });
    expect(stored).not.toBeNull();
    expect(stored?.expires_at.getTime()).toBeGreaterThan(Date.now() + 10 * 60_000);
    expect(stored?.guardian_user_id).toBe(guardian.user.id);
  });

  it('rejects a garbage invite code', async () => {
    const elder = await devLogin(app, 'elder');
    const res = await request(app)
      .post('/api/v1/family-links/accept')
      .set('Authorization', `Bearer ${elder.token}`)
      .send({ invite_code: 'not-a-valid-code' });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ code: 'INVALID_INVITE_CODE' });
  });

  it('enforces roles: elder cannot invite, guardian cannot accept', async () => {
    const guardian = await devLogin(app, 'guardian');
    const elder = await devLogin(app, 'elder');

    const elderInvites = await request(app)
      .post('/api/v1/family-links/invite')
      .set('Authorization', `Bearer ${elder.token}`);
    expect(elderInvites.status).toBe(403);
    expect(elderInvites.body).toMatchObject({ code: 'FORBIDDEN' });

    const guardianAccepts = await request(app)
      .post('/api/v1/family-links/accept')
      .set('Authorization', `Bearer ${guardian.token}`)
      .send({ invite_code: 'whatever' });
    expect(guardianAccepts.status).toBe(403);
    expect(guardianAccepts.body).toMatchObject({ code: 'FORBIDDEN' });
  });

  it('lists active links for both parties', async () => {
    const guardian = await devLogin(app, 'guardian');
    const elder = await devLogin(app, 'elder');

    const invite = await request(app)
      .post('/api/v1/family-links/invite')
      .set('Authorization', `Bearer ${guardian.token}`);
    await request(app)
      .post('/api/v1/family-links/accept')
      .set('Authorization', `Bearer ${elder.token}`)
      .send({ invite_code: invite.body.invite_code });

    for (const party of [guardian, elder]) {
      const res = await request(app)
        .get('/api/v1/family-links')
        .set('Authorization', `Bearer ${party.token}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect([res.body[0].elder_user_id, res.body[0].guardian_user_id]).toContain(party.user.id);
    }
  });
});
