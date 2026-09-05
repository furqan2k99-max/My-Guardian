import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient({ 
    // Use the helper for Prisma 5.x compatibility
    // The datasource helper is auto-injected by the test runner
  });
  
  try {
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
    
    // Also check for any guardian events
    const allEvents = await prisma.flaggedEvent.findMany({ take: 10 });
    console.log('\nTotal flagged events in DB:', allEvents.length);
    
  } catch (err) {
    console.error('DB error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

main();