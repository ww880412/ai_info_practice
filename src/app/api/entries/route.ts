import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseBulkDeleteIds } from "@/lib/entries/bulk-delete";
import { deleteEntriesWithDependencies } from "@/lib/entries/delete";

/**
 * GET /api/entries - List entries with filtering, search, and pagination.
 *
 * Query params:
 * - page, pageSize: pagination
 * - q: search text
 * - contentType, techDomain, practiceValue, processStatus, sourceType: exact match filters
 * - aiTagsAll: AI tags all match (comma separated)
 * - aiTagsAny: AI tags any match (comma separated)
 * - userTagsAll: user tags all match (comma separated)
 * - userTagsAny: user tags any match (comma separated)
 * - sort: createdAt | updatedAt | confidence | practiceValue | difficulty | smart
 *
 * Boolean logic (hardcoded):
 * - Same category: All AND Any
 * - Cross category: OR
 * - Formula: (aiAll AND aiAny) OR (userAll AND userAny)
 * - All not passed = true, Any not passed = true
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get("pageSize") || "20")));
    const q = searchParams.get("q") || "";
    const contentType = searchParams.get("contentType");
    const techDomain = searchParams.get("techDomain");
    const practiceValue = searchParams.get("practiceValue");
    const processStatus = searchParams.get("processStatus");
    const sourceType = searchParams.get("sourceType");

    // Tag filters
    const aiTagsAll = searchParams.get("aiTagsAll");
    const aiTagsAny = searchParams.get("aiTagsAny");
    const userTagsAll = searchParams.get("userTagsAll");
    const userTagsAny = searchParams.get("userTagsAny");

    // Sort
    const sort = searchParams.get("sort") || "createdAt";

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: Record<string, any> = {};

    // Search
    if (q) {
      where.OR = [
        { title: { contains: q, mode: "insensitive" } },
        { coreSummary: { contains: q, mode: "insensitive" } },
        { aiTags: { has: q } },
        { userTags: { has: q } },
      ];
    }

    // Exact match filters
    if (contentType) where.contentType = contentType;
    if (techDomain) where.techDomain = techDomain;
    if (practiceValue) where.practiceValue = practiceValue;
    if (processStatus) where.processStatus = processStatus;
    if (sourceType) where.sourceType = sourceType;

    // Tag filtering logic: (aiAll AND aiAny) OR (userAll AND userAny)
    // All not passed = true, Any not passed = true
    const aiTagsAllList = aiTagsAll ? aiTagsAll.split(",").filter(Boolean) : [];
    const aiTagsAnyList = aiTagsAny ? aiTagsAny.split(",").filter(Boolean) : [];
    const userTagsAllList = userTagsAll ? userTagsAll.split(",").filter(Boolean) : [];
    const userTagsAnyList = userTagsAny ? userTagsAny.split(",").filter(Boolean) : [];

    const hasAiFilter = aiTagsAllList.length > 0 || aiTagsAnyList.length > 0;
    const hasUserFilter = userTagsAllList.length > 0 || userTagsAnyList.length > 0;

    if (hasAiFilter || hasUserFilter) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const aiCondition: any = {};
      if (aiTagsAllList.length > 0) aiCondition.hasEvery = aiTagsAllList;
      if (aiTagsAnyList.length > 0) {
        // For hasSome, need at least one match
        if (aiCondition.hasEvery) {
          // Both: must have all from aiAll AND at least one from aiAny
          aiCondition.AND = [
            { aiTags: { hasEvery: aiTagsAllList } },
            { aiTags: { hasSome: aiTagsAnyList } },
          ];
          delete aiCondition.hasEvery;
        } else {
          aiCondition.hasSome = aiTagsAnyList;
        }
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const userCondition: any = {};
      if (userTagsAllList.length > 0) userCondition.hasEvery = userTagsAllList;
      if (userTagsAnyList.length > 0) {
        if (userCondition.hasEvery) {
          userCondition.AND = [
            { userTags: { hasEvery: userTagsAllList } },
            { userTags: { hasSome: userTagsAnyList } },
          ];
          delete userCondition.hasEvery;
        } else {
          userCondition.hasSome = userTagsAnyList;
        }
      }

      // Build combined condition
      if (hasAiFilter && hasUserFilter) {
        where.OR = [
          { AND: [aiCondition, { NOT: userCondition }] },
          { AND: [{ NOT: aiCondition }, userCondition] },
          { AND: [aiCondition, userCondition] },
        ];
      } else if (hasAiFilter) {
        Object.assign(where, aiCondition);
      } else {
        Object.assign(where, userCondition);
      }
    }

    // Determine orderBy
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let orderBy: any = { createdAt: "desc" };
    if (sort === "updatedAt") orderBy = { updatedAt: "desc" };
    else if (sort === "confidence") orderBy = { confidence: "desc" };
    else if (sort === "practiceValue") orderBy = { practiceValue: "desc" };
    else if (sort === "difficulty") orderBy = { difficulty: "asc" };
    else if (sort === "smart") orderBy = { updatedAt: "desc" };

    const [data, total] = await Promise.all([
      prisma.entry.findMany({
        where,
        include: {
          practiceTask: {
            include: {
              steps: { orderBy: { order: "asc" } },
            },
          },
        },
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.entry.count({ where }),
    ]);

    return NextResponse.json({ data, total, page, pageSize });
  } catch (error) {
    console.error("List entries error:", error);
    return NextResponse.json({ error: "Failed to list entries" }, { status: 500 });
  }
}

/**
 * DELETE /api/entries - Batch delete entries by ids.
 */
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const ids = parseBulkDeleteIds(body);

    if (ids.length === 0) {
      return NextResponse.json(
        { error: "ids must be a non-empty string array" },
        { status: 400 }
      );
    }

    const result = await deleteEntriesWithDependencies(ids);

    return NextResponse.json({
      success: true,
      deletedCount: result.deletedCount,
      requestedCount: ids.length,
    });
  } catch (error) {
    console.error("Batch delete entries error:", error);
    return NextResponse.json(
      { error: "Failed to batch delete entries" },
      { status: 500 }
    );
  }
}
