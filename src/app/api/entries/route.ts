import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import {
  ContentType,
  ProcessStatus,
  PracticeValue,
  SourceType,
  TechDomain,
  KnowledgeStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { parseBulkDeleteIds } from "@/lib/entries/bulk-delete";
import { deleteEntriesWithDependencies } from "@/lib/entries/delete";
import {
  buildCombinedTagFilterCondition,
  normalizeTagList,
} from "@/lib/entries/tag-filter";

function parseEnum<T extends string>(value: string | null, allowed: readonly T[]): T | undefined {
  if (!value) return undefined;
  if ((allowed as readonly string[]).includes(value)) return value as T;
  return undefined;
}

/**
 * GET /api/entries - List entries with filtering, search, and pagination.
 *
 * Query params:
 * - page, pageSize: pagination
 * - q: search text
 * - contentType, techDomain, practiceValue, processStatus, sourceType, knowledgeStatus: exact match filters
 * - aiTagsAll: AI tags all match (comma separated)
 * - aiTagsAny: AI tags any match (comma separated)
 * - userTagsAll: user tags all match (comma separated)
 * - userTagsAny: user tags any match (comma separated)
 * - sort: createdAt | updatedAt | confidence | practiceValue | difficulty | smart (legacy)
 * - sortBy: createdAt | updatedAt | title (new)
 * - sortOrder: asc | desc (new, default: desc)
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
    const groupId = searchParams.get("groupId");
    const q = searchParams.get("q") || "";
    const contentType = parseEnum(searchParams.get("contentType"), Object.values(ContentType));
    const techDomain = parseEnum(searchParams.get("techDomain"), Object.values(TechDomain));
    const practiceValue = parseEnum(searchParams.get("practiceValue"), Object.values(PracticeValue));
    const processStatus = parseEnum(searchParams.get("processStatus"), Object.values(ProcessStatus));
    const sourceType = parseEnum(searchParams.get("sourceType"), Object.values(SourceType));
    const knowledgeStatus = parseEnum(searchParams.get("knowledgeStatus"), Object.values(KnowledgeStatus));

    // Tag filters
    const aiTagsAll = searchParams.get("aiTagsAll");
    const aiTagsAny = searchParams.get("aiTagsAny");
    const userTagsAll = searchParams.get("userTagsAll");
    const userTagsAny = searchParams.get("userTagsAny");

    // Sort
    const sort = searchParams.get("sort") || "createdAt";
    const sortBy = searchParams.get("sortBy") || "createdAt";
    const sortOrder = searchParams.get("sortOrder") || "desc";

    const where: Prisma.EntryWhereInput = {};
    const andConditions: Prisma.EntryWhereInput[] = [];

    // Search
    if (q) {
      andConditions.push({
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { coreSummary: { contains: q, mode: "insensitive" } },
          { aiTags: { has: q } },
          { userTags: { has: q } },
        ],
      });
    }

    // Exact match filters
    if (contentType) where.contentType = contentType;
    if (techDomain) where.techDomain = techDomain;
    if (practiceValue) where.practiceValue = practiceValue;
    if (processStatus) where.processStatus = processStatus;
    if (sourceType) where.sourceType = sourceType;
    if (knowledgeStatus) where.knowledgeStatus = knowledgeStatus;
    if (groupId) {
      where.groups = { some: { id: groupId } };
    }

    // Tag filtering logic: (aiAll AND aiAny) OR (userAll AND userAny)
    // All not passed = true, Any not passed = true
    const tagFilterCondition = buildCombinedTagFilterCondition({
      aiAll: normalizeTagList(aiTagsAll),
      aiAny: normalizeTagList(aiTagsAny),
      userAll: normalizeTagList(userTagsAll),
      userAny: normalizeTagList(userTagsAny),
    });
    if (tagFilterCondition) {
      andConditions.push(tagFilterCondition);
    }

    if (andConditions.length > 0) {
      where.AND = andConditions;
    }

    // Determine orderBy
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let orderBy: any = { createdAt: "desc" };

    // Support legacy 'sort' parameter for backward compatibility
    if (sort === "updatedAt") orderBy = { updatedAt: "desc" };
    else if (sort === "confidence") orderBy = { confidence: "desc" };
    else if (sort === "practiceValue") orderBy = { practiceValue: "desc" };
    else if (sort === "difficulty") orderBy = { difficulty: "asc" };
    else if (sort === "smart") orderBy = { updatedAt: "desc" };

    // New sortBy/sortOrder parameters take precedence
    if (sortBy && sortBy !== "createdAt") {
      const order = sortOrder === "asc" ? "asc" : "desc";
      if (sortBy === "updatedAt") orderBy = { updatedAt: order };
      else if (sortBy === "title") orderBy = { title: order };
      else if (sortBy === "createdAt") orderBy = { createdAt: order };
    } else if (sortBy === "createdAt") {
      const order = sortOrder === "asc" ? "asc" : "desc";
      orderBy = { createdAt: order };
    }

    const [data, total] = await Promise.all([
      prisma.entry.findMany({
        where,
        include: {
          practiceTask: {
            include: {
              steps: { orderBy: { order: "asc" } },
            },
          },
          // B2.1: Include new split tables
          aiResults: { where: { isActive: true }, take: 1 },
          evaluation: true,
          smartSummaryRelation: true,
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
