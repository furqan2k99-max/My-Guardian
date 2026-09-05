// Print dev-login + pairing info for the user to type into the polished app.
// Guardian already paired: guardian-test-pair-001 <-> elder-test-pair-001
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const g = await prisma.user.findFirst({ where: { phone_number_hash: 'guardian-test-pair-001' } });
  const e = await prisma.user.findFirst({ where: { phone_number_hash: 'elder-test-pair-001' } });
  console.log('PAIRED GUARDIAN');
  console.log('  user_id:', g.id);
  console.log('  phone_number_hash: guardian-test-pair-001');
  console.log('');
  console.log('PAIRED ELDER');
  console.log('  user_id:', e.id);
  console.log('  phone_number_hash: elder-test-pair-001');
  await prisma.$disconnect();
})();
