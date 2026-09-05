import http from 'http';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function postRequest(path, body, token) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost', port: 4000, path, method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: 'Bearer ' + token } : {})
      }
    };
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { resolve(data); }
      });
    });
    req.on('error', reject);
    req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  // Step 1: Create guardian user
  console.log('=== Step 1: Create guardian user ===');
  const guardianLogin = await postRequest('/api/v1/auth/dev-login', { role: 'guardian', phone_number_hash: 'guardian-test-pair-001' });
  console.log('Guardian login response:', JSON.stringify(guardianLogin, null, 2));
  const gToken = guardianLogin.access_token || guardianLogin.token;
  console.log('Guardian token:', gToken ? gToken.substring(0, 30) + '...' : 'NONE');

  // Step 2: Create elder user
  console.log('\n=== Step 2: Create elder user ===');
  const elderLogin = await postRequest('/api/v1/auth/dev-login', { role: 'elder', phone_number_hash: 'elder-test-pair-001' });
  console.log('Elder login response:', JSON.stringify(elderLogin, null, 2));
  const eToken = elderLogin.access_token || elderLogin.token;
  console.log('Elder token:', eToken ? eToken.substring(0, 30) + '...' : 'NONE');

  // Step 3: Guardian generates invite code
  console.log('\n=== Step 3: Guardian generates invite code ===');
  const invite = await postRequest('/api/v1/family-links/invite', {}, gToken);
  console.log('Invite response:', JSON.stringify(invite, null, 2));
  const code = invite.invite_code;
  console.log('Invite code:', code);

  // Step 4: Elder accepts invite
  console.log('\n=== Step 4: Elder accepts invite ===');
  const accept = await postRequest('/api/v1/family-links/accept', { invite_code: code }, eToken);
  console.log('Accept response:', JSON.stringify(accept, null, 2));

  // Step 5: Verify family link
  console.log('\n=== Step 5: Verify family links ===');
  const elderLinks = await postRequest('/api/v1/family-links', {}, eToken);
  console.log('Elder family links:', JSON.stringify(elderLinks, null, 2));

  const guardianLinks = await postRequest('/api/v1/family-links', {}, gToken);
  console.log('Guardian family links:', JSON.stringify(guardianLinks, null, 2));

  // Check DB directly
  const links = await prisma.familyLink.findMany({
    include: { elder_user: true, guardian_user: true }
  });
  console.log('\nDB family_links:', JSON.stringify(links, null, 2));

  await prisma.$disconnect();
  console.log('\n=== SETUP COMPLETE ===');
}

main().catch(e => { console.error('Error:', e); process.exit(1); });