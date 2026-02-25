import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { aggregateTags } from "@/lib/tag-aggregation";

function parsePositiveInt(value: string | null, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const topTagLimit = parsePositiveInt(searchParams.get("topTagLimit"), 10);
    const minTagCount = parsePositiveInt(searchParams.get("minTagCount"), 2);

    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
      total,
      weekNew,
      processing,
      failed,
      recentEntries,
      allEntries,
      knowledgeStatusCounts,
      toReviewCount,
    ] = await Promise.all([
      prisma.entry.count(),
      prisma.entry.count({ where: { createdAt: { gte: weekAgo } } }),
      prisma.entry.count({ where: { processStatus: { in: ["PENDING", "PARSING", "AI_PROCESSING"] } } }),
      prisma.entry.count({ where: { processStatus: "FAILED" } }),
      prisma.entry.findMany({
        select: { id: true, title: true, sourceType: true, createdAt: true, processStatus: true },
        orderBy: { updatedAt: "desc" },
        take: 10,
      }),
      prisma.entry.findMany({
        select: { aiTags: true, difficulty: true },
      }),
      // B2.5: Knowledge status distribution
      prisma.entry.groupBy({
        by: ["knowledgeStatus"],
        _count: true,
      }),
      // B2.5: To review count
      prisma.entry.count({ where: { knowledgeStatus: "TO_REVIEW" } }),
    ]);

    const aiTagCounts = new Map<string, number>();
    for (const entry of allEntries) {
      for (const tag of entry.aiTags) {
        aiTagCounts.set(tag, (aiTagCounts.get(tag) || 0) + 1);
      }
    }
    const topTags = aggregateTags(
      Array.from(aiTagCounts.entries()).map(([tag, count]) => ({ tag, count })),
      { limit: topTagLimit, minCount: minTagCount, semantic: true }
    );

    const difficultyStats = { EASY: 0, MEDIUM: 0, HARD: 0, unknown: 0 };
    for (const entry of allEntries) {
      if (entry.difficulty === "EASY") difficultyStats.EASY++;
      else if (entry.difficulty === "MEDIUM") difficultyStats.MEDIUM++;
      else if (entry.difficulty === "HARD") difficultyStats.HARD++;
      else difficultyStats.unknown++;
    }

    // B2.5: Weekly trend (last 7 days)
    const weeklyTrend: Array<{ date: string; count: number }> = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const startOfDay = new Date(date.setHours(0, 0, 0, 0));
      const endOfDay = new Date(date.setHours(23, 59, 59, 999));
      const count = await prisma.entry.count({
        where: {
          createdAt: {
            gte: startOfDay,
            lte: endOfDay,
          },
        },
      });
      weeklyTrend.push({
        date: startOfDay.toISOString().split("T")[0],
        count,
      });
    }

    // B2.5: Format knowledge status counts
    const knowledgeStatusMap: Record<string, number> = {};
    for (const item of knowledgeStatusCounts) {
      knowledgeStatusMap[item.knowledgeStatus] = item._count;
    }

    return NextResponse.json({
      data: {
        total,
        weekNew,
        processing,
        failed,
        recentEntries,
        topTags,
        difficultyStats,
        knowledgeStatusCounts: knowledgeStatusMap,
        toReviewCount,
        weeklyTrend,
      },
    });
  } catch (error) {
    console.error("Dashboard stats error:", error);
    return NextResponse.json({ error: "Failed to fetch dashboard stats" }, { status: 500 });
  }
}
