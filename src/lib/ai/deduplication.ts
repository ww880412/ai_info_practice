import { prisma } from "@/lib/prisma";
import type { Entry } from "@prisma/client";

/**
 * Calculate similarity between two texts using simple token overlap (Jaccard similarity)
 */
export function calculateSimilarity(text1: string, text2: string): number {
  const tokens1 = new Set(
    text1.toLowerCase().split(/\s+/).filter((t) => t.length > 2)
  );
  const tokens2 = new Set(
    text2.toLowerCase().split(/\s+/).filter((t) => t.length > 2)
  );

  if (tokens1.size === 0 || tokens2.size === 0) return 0;

  const intersection = new Set(
    [...tokens1].filter((t) => tokens2.has(t))
  );
  const union = new Set([...tokens1, ...tokens2]);

  return intersection.size / union.size;
}

/**
 * Find similar entries in database
 */
export async function findSimilarEntries(
  content: string,
  threshold: number = 0.5
): Promise<
  Array<{
    id: string;
    title: string | null;
    coreSummary: string | null;
    similarity: number;
  }>
> {
  // Get recent entries (last 100)
  const recentEntries = await prisma.entry.findMany({
    take: 100,
    orderBy: { createdAt: "desc" },
    where: {
      originalContent: { not: null },
    },
    select: {
      id: true,
      title: true,
      originalContent: true,
      coreSummary: true,
    },
  });

  const similarEntries = recentEntries
    .filter((entry) => {
      if (!entry.originalContent) return false;
      const similarity = calculateSimilarity(content, entry.originalContent);
      return similarity >= threshold;
    })
    .map((entry) => ({
      id: entry.id,
      title: entry.title,
      coreSummary: entry.coreSummary,
      similarity: calculateSimilarity(
        content,
        entry.originalContent || ""
      ),
    }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 5);

  return similarEntries;
}
