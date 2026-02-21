import { prisma } from "@/lib/prisma";
import { generateJSON } from "../gemini";

export interface RelatedEntry {
  id: string;
  title: string;
  summary: string;
  similarity: number;
  relationType: string; // "similar_topic", "builds_on", "complementary", "contrasting"
}

const ASSOCIATION_PROMPT = `Given a list of existing entries and a new entry, identify related entries.

New Entry:
- Title: {title}
- Summary: {summary}
- Tags: {tags}

Existing Entries:
{existingEntries}

For each related entry, identify:
1. similarity score (0-1)
2. relation type: "similar_topic", "builds_on", "complementary", or "contrasting"

Respond in JSON format:
{
  "relatedEntries": [
    {
      "id": "entry_id",
      "title": "...",
      "summary": "...",
      "similarity": 0.8,
      "relationType": "similar_topic"
    }
  ]
}`;

export async function findRelatedEntries(
  entryId: string,
  limit: number = 5
): Promise<RelatedEntry[]> {
  const entry = await prisma.entry.findUnique({
    where: { id: entryId },
  });

  if (!entry) return [];

  // Get other entries
  const otherEntries = await prisma.entry.findMany({
    where: { id: { not: entryId } },
    take: 20,
    orderBy: { createdAt: 'desc' },
  });

  if (otherEntries.length === 0) return [];

  // Use AI to find related entries
  const existingEntriesText = otherEntries
    .map(e => `- ID: ${e.id}, Title: ${e.title || 'Untitled'}, Summary: ${e.coreSummary || e.originalContent?.slice(0, 200) || ''}`)
    .join('\n');

  const prompt = ASSOCIATION_PROMPT
    .replace('{title}', entry.title || 'Untitled')
    .replace('{summary}', entry.coreSummary || entry.originalContent?.slice(0, 500) || '')
    .replace('{tags}', (entry.aiTags || []).join(', '))
    .replace('{existingEntries}', existingEntriesText);

  try {
    const result = await generateJSON<{ relatedEntries: RelatedEntry[] }>(prompt);
    return result.relatedEntries || [];
  } catch (error) {
    console.error("Association discovery error:", error);
    return [];
  }
}
