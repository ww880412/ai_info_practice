import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { aggregateTags } from "@/lib/tag-aggregation";

function parsePositiveInt(value: string | null, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

/**
 * GET /api/tags/stats - Get tag statistics.
 *
 * Query params:
 * - scope: 'all' (default) | 'recent30d'
 *
 * Response:
 * {
 *   "data": {
 *     "aiTags": [{ "tag": "Agent", "count": 12, "aliases": [...], "filterTags": [...] }, ...],
 *     "userTags": [{ "tag": "重要", "count": 8, "aliases": [...], "filterTags": [...] }, ...]
 *   }
 * }
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const scope = searchParams.get("scope") || "all";
    const limit = parsePositiveInt(searchParams.get("limit"), 50);
    const minCount = parsePositiveInt(searchParams.get("minCount"), 2);

    const where = scope === "recent30d"
      ? { createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } }
      : {};

    const entries = await prisma.entry.findMany({
      where,
      select: { aiTags: true, userTags: true },
    });

    // Count aiTags
    const aiTagCounts = new Map<string, number>();
    const userTagCounts = new Map<string, number>();

    for (const entry of entries) {
      for (const tag of entry.aiTags) {
        aiTagCounts.set(tag, (aiTagCounts.get(tag) || 0) + 1);
      }
      for (const tag of entry.userTags) {
        userTagCounts.set(tag, (userTagCounts.get(tag) || 0) + 1);
      }
    }

    const aiTags = aggregateTags(
      Array.from(aiTagCounts.entries()).map(([tag, count]) => ({ tag, count })),
      { limit, minCount, semantic: true }
    );

    const userTags = aggregateTags(
      Array.from(userTagCounts.entries()).map(([tag, count]) => ({ tag, count })),
      { limit, minCount, semantic: false }
    );

    return NextResponse.json({ data: { aiTags, userTags } });
  } catch (error) {
    console.error("Get tags stats error:", error);
    return NextResponse.json({ error: "Failed to get tags stats" }, { status: 500 });
  }
}
