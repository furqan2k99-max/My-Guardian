import 'dotenv/config';
import { FamilyLinkStatus, Role } from '@prisma/client';
import { prisma } from '../src/db/prisma';

/**
 * Prisma data-model tests.
 * NOTE: these require a reachable PostgreSQL with the schema migrated
 * (see README). The /health tests do not need a database.
 */

describe('Prisma data model', () => {
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

  it('creates users with the role enum', async () => {
    const elder = await prisma.user.create({
      data: { role: Role.elder, phone_number_hash: 'hash-elder-1' },
    });
    const guardian = await prisma.user.create({
      data: { role: Role.guardian, phone_number_hash: 'hash-guardian-1' },
    });

    expect(elder.id).toBeDefined();
    expect(elder.role).toBe(Role.elder);
    expect(elder.created_at).toBeInstanceOf(Date);
    expect(guardian.id).toBeDefined();
    expect(guardian.role).toBe(Role.guardian);
  });

  it('creates a family_link referencing elder and guardian users', async () => {
    const elder = await prisma.user.create({
      data: { role: Role.elder, phone_number_hash: 'hash-elder-2' },
    });
    const guardian = await prisma.user.create({
      data: { role: Role.guardian, phone_number_hash: 'hash-guardian-2' },
    });

    const link = await prisma.familyLink.create({
      data: {
        elder_user_id: elder.id,
        guardian_user_id: guardian.id,
        status: FamilyLinkStatus.pending,
      },
    });

    expect(link.id).toBeDefined();
    expect(link.status).toBe(FamilyLinkStatus.pending);

    const withRelations = await prisma.familyLink.findUnique({
      where: { id: link.id },
      include: { elder_user: true, guardian_user: true },
    });

    expect(withRelations?.elder_user.id).toBe(elder.id);
    expect(withRelations?.guardian_user.id).toBe(guardian.id);
  });

  it('enforces foreign keys when linking to non-existent users', async () => {
    await expect(
      prisma.familyLink.create({
        data: {
          elder_user_id: 'missing-user-id',
          guardian_user_id: 'missing-user-id',
        },
      }),
    ).rejects.toThrow();
  });

  it('defaults status to pending and transitions to active', async () => {
    const elder = await prisma.user.create({
      data: { role: Role.elder, phone_number_hash: 'hash-elder-3' },
    });
    const guardian = await prisma.user.create({
      data: { role: Role.guardian, phone_number_hash: 'hash-guardian-3' },
    });

    const created = await prisma.familyLink.create({
      data: { elder_user_id: elder.id, guardian_user_id: guardian.id },
    });
    expect(created.status).toBe(FamilyLinkStatus.pending);

    const updated = await prisma.familyLink.update({
      where: { id: created.id },
      data: { status: FamilyLinkStatus.active },
    });
    expect(updated.status).toBe(FamilyLinkStatus.active);
  });
});
