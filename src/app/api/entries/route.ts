import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/entries - List entries with filtering, search, and pagination.
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

    // Filters
    if (contentType) where.contentType = contentType;
    if (techDomain) where.techDomain = techDomain;
    if (practiceValue) where.practiceValue = practiceValue;
    if (processStatus) where.processStatus = processStatus;
    if (sourceType) where.sourceType = sourceType;

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
        orderBy: { createdAt: "desc" },
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
