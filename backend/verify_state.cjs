const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const events = await prisma.flaggedEvent.findMany({ take: 10, orderBy: { created_at: 'desc' } });
  console.log('Total events:', events.length);
  events.forEach(e => console.log('  ', e.event_type, 'score=' + e.risk_score, 'notified=' + (e.guardian_notified_at ? 'yes' : 'no')));
  const tokens = await prisma.deviceToken.findMany();
  console.log('Device tokens:', tokens.length);
  tokens.forEach(t => console.log('  ', t.platform, t.token.substring(0,40) + '...'));
  await prisma.$disconnect();
})();
