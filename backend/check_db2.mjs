import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
async function main() {
  const events = await p.flaggedEvent.findMany({ orderBy: { created_at: 'desc' }, take: 5, include: { elder_user: true } });
  console.log('Flagged events:', events.length);
  events.forEach(e => console.log('  id:', e.id, 'risk_score:', e.risk_score, 'guardian_notified_at:', e.guardian_notified_at, 'reasons:', e.risk_reasons));
  const links = await p.familyLink.findMany({ include: { elder_user: true, guardian_user: true } });
  console.log('Family links:', links.length);
  links.forEach(l => console.log('  id:', l.id, 'status:', l.status, 'elder:', l.elder_user.id, 'guardian:', l.guardian_user.id));
  await p.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });