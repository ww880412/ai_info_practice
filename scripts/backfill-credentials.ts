import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function backfillCredentials() {
  console.log('Starting credential backfill...');

  // Get all existing credentials
  const credentials = await prisma.apiCredential.findMany({
    orderBy: [
      { provider: 'asc' },
      { createdAt: 'asc' }
    ]
  });

  console.log(`Found ${credentials.length} credentials to backfill`);

  // Group by provider
  const byProvider = credentials.reduce((acc, cred) => {
    if (!acc[cred.provider]) {
      acc[cred.provider] = [];
    }
    acc[cred.provider].push(cred);
    return acc;
  }, {} as Record<string, typeof credentials>);

  let updated = 0;

  // Process each provider
  for (const [provider, creds] of Object.entries(byProvider)) {
    console.log(`\nProcessing ${provider}: ${creds.length} credential(s)`);

    // Check if any credential already has isDefault=true
    const hasDefault = creds.some(c => c.isDefault === true);

    for (let i = 0; i < creds.length; i++) {
      const cred = creds[i];

      // Generate name if not exists
      let name = cred.name;
      if (!name) {
        if (creds.length === 1) {
          name = `${provider}-default`;
        } else {
          name = `${provider}-${i + 1}`;
        }
      }

      // Set isDefault for first credential per provider (only if no default exists)
      const isDefault = hasDefault ? (cred.isDefault === true) : (i === 0);

      // Update credential
      await prisma.apiCredential.update({
        where: { id: cred.id },
        data: {
          name,
          isDefault,
          isActive: true
        }
      });

      console.log(`  ✓ Updated ${cred.id}: name="${name}", isDefault=${isDefault}`);
      updated++;
    }
  }

  console.log(`\n✅ Backfill complete: ${updated} credentials updated`);

  // Verify results
  const verification = await prisma.apiCredential.findMany({
    select: {
      id: true,
      provider: true,
      name: true,
      isDefault: true,
      isActive: true
    },
    orderBy: [
      { provider: 'asc' },
      { isDefault: 'desc' }
    ]
  });

  console.log('\nVerification:');
  console.table(verification);
}

backfillCredentials()
  .catch((error) => {
    console.error('❌ Backfill failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
