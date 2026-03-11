import { prisma } from '@/lib/prisma';

/**
 * Auto-repair function to ensure only one default credential per provider
 * Keeps the oldest default and unsets others
 */
export async function repairDefaultCredentials() {
  const providers = ['gemini', 'crs', 'openai-compatible'];
  const repairs: string[] = [];

  for (const provider of providers) {
    // Find all default credentials for this provider
    const defaults = await prisma.apiCredential.findMany({
      where: {
        provider,
        isDefault: true,
        isActive: true,
      },
      orderBy: { createdAt: 'asc' }, // Keep oldest
    });

    // If multiple defaults exist, keep the first (oldest) and unset others
    if (defaults.length > 1) {
      const toUnset = defaults.slice(1).map((c) => c.id);

      await prisma.apiCredential.updateMany({
        where: { id: { in: toUnset } },
        data: { isDefault: false },
      });

      repairs.push(
        `${provider}: kept ${defaults[0].id} (${defaults[0].name}), unset ${toUnset.length} others`
      );
      console.log(`  ✓ Repaired ${provider}: ${toUnset.length} duplicates fixed`);
    }
  }

  return repairs;
}
