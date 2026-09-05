// Worker script: checks DB for flagged events after semantic analysis
import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient({
    datasource: { 
      url: 'postgresql://postgres:postgres@localhost:5432/myguardian_test?schema=postgres' 
    }
  });
  
  // Wait a bit for the semantic worker to complete
  await new Promise(r => setTimeout(r, 15000));
  
  console.log('=== DB Check ===');
  
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
  
  // Also check for the live-test user
  const events2 = await prisma.flaggedEvent.findMany({
    where: { sender_hash: 'live-test@example.com' },
    orderBy: { created_at: 'desc' },
    take: 5
  });
  console.log('\nFlagged events for live-test@example.com:', events2.length);
  events2.forEach((e, i) => {
    console.log('Event ' + (i+1) + ':');
    console.log('  event_type: ' + e.event_type);
    console.log('  risk_score: ' + e.risk_score);
    console.log('  guardian_notified_at: ' + e.guardian_notified_at);
  });
  
  await prisma.$disconnect();
  console.log('Worker complete.');
}

main().catch(err => { console.error('Worker error:', err); process.exit(1); });