const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const links = await prisma.familyLink.findMany({
    where: { status: 'active' },
    include: { elder_user: true, guardian_user: true },
  });
  console.log('Active family links:', links.length);
  links.forEach(l => {
    console.log('  link_id:', l.id);
    console.log('  elder_hash:', l.elder_user.phone_number_hash);
    console.log('  guardian_hash:', l.guardian_user.phone_number_hash);
    console.log('  status:', l.status);
    console.log('  ---');
  });
  const users = await prisma.user.findMany({ where: { role: 'guardian' }, take: 10, orderBy: { created_at: 'desc' } });
  console.log('Recent guardians:');
  users.forEach(u => console.log('  ', u.id, u.phone_number_hash));
  await prisma.$disconnect();
})();
