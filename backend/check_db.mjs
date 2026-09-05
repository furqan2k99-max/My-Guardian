import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient({ 
    datasource: { url: 'postgresql://postgres:postgres@localhost:5432/myguardian_test?schema=postgres' } 
  });
  
  await prisma.$connect();
  
  const events = await prisma.flaggedEvent.findMany({
    where: { sender_hash: 'test-hash-123' },
    orderBy: { created_at: 'desc' },
    take: 5
  });
  
  console.log('Flagged events for test-hash-123:', events.length);
  events.forEach((e, i) => {
    console.log('Event ' + (i+1) + ':');
    console.log('  event_type: ' + e.event_type);
    console.log('  risk_score: ' + e.risk_score);
    console.log('  risk_reasons: ' + JSON.stringify(e.risk_reasons));
    console.log('  guardian_notified_at: ' + e.guardian_notified_at);
    console.log('  created_at: ' + e.created_at);
  });
  
  await prisma.$disconnect();
}

main().catch(err => { console.error('Error:', err); process.exit(1); });