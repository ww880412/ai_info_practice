import { PrismaClient } from '@prisma/client';
import { encryptApiKey, getKeyHint } from '../src/lib/crypto';

const prisma = new PrismaClient();

async function seedCredentials() {
  console.log('Starting credential seeding...');

  // Check if DB is empty
  const existingCount = await prisma.apiCredential.count();
  if (existingCount > 0) {
    console.log(`Database already has ${existingCount} credentials, skipping seed`);
    return;
  }

  const credentials = [];

  // Gemini
  if (process.env.GEMINI_API_KEY) {
    credentials.push({
      provider: 'gemini',
      name: 'Gemini Default',
      encryptedKey: encryptApiKey(process.env.GEMINI_API_KEY),
      keyHint: getKeyHint(process.env.GEMINI_API_KEY),
      model: process.env.GEMINI_MODEL || 'gemini-2.0-flash-exp',
      isDefault: true,
      isActive: true,
      isValid: true,
    });
    console.log('  ✓ Prepared Gemini credential');
  }

  // CRS
  if (process.env.CRS_API_KEY) {
    credentials.push({
      provider: 'crs',
      name: 'CRS Default',
      encryptedKey: encryptApiKey(process.env.CRS_API_KEY),
      keyHint: getKeyHint(process.env.CRS_API_KEY),
      baseUrl: process.env.CRS_BASE_URL,
      model: process.env.CRS_MODEL || 'gpt-5.4',
      isDefault: true,
      isActive: true,
      isValid: true,
    });
    console.log('  ✓ Prepared CRS credential');
  }

  if (credentials.length === 0) {
    console.log('No credentials in .env, skipping seed');
    return;
  }

  // Create credentials
  for (const cred of credentials) {
    await prisma.apiCredential.create({ data: cred });
  }

  console.log(`\n✅ Seeded ${credentials.length} credentials`);

  // Verify results
  const verification = await prisma.apiCredential.findMany({
    select: {
      id: true,
      provider: true,
      name: true,
      isDefault: true,
      isActive: true,
      keyHint: true,
    },
  });

  console.log('\nVerification:');
  console.table(verification);
}

seedCredentials()
  .catch((error) => {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
