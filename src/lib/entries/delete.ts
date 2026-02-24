import { prisma } from "@/lib/prisma";

/**
 * Delete entries with dependent parse logs in a single transaction.
 * Some environments may not have ON DELETE CASCADE on ParseLog relation.
 */
export async function deleteEntriesWithDependencies(ids: string[]) {
  const uniqueIds = Array.from(new Set(ids));
  if (uniqueIds.length === 0) {
    return { deletedCount: 0 };
  }

  const [, entryDeleteResult] = await prisma.$transaction([
    prisma.parseLog.deleteMany({
      where: {
        entryId: { in: uniqueIds },
      },
    }),
    prisma.entry.deleteMany({
      where: {
        id: { in: uniqueIds },
      },
    }),
  ]);

  return { deletedCount: entryDeleteResult.count };
}

export async function deleteEntryWithDependencies(id: string) {
  await prisma.$transaction([
    prisma.parseLog.deleteMany({
      where: { entryId: id },
    }),
    prisma.entry.delete({
      where: { id },
    }),
  ]);
}
