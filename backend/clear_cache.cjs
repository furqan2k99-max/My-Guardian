const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const c = await prisma.reputationCache.deleteMany({});
  console.log('Cleared', c.count, 'cached reputation entries');
  await prisma.$disconnect();
})();
