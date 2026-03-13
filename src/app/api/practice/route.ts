import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/practice - List practice tasks with filtering.
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get("status");
    const difficulty = searchParams.get("difficulty");

     
    const where: Record<string, any> = {};
    if (status) where.status = status;
    if (difficulty) where.difficulty = difficulty;

    const tasks = await prisma.practiceTask.findMany({
      where,
      include: {
        entry: {
          select: {
            id: true,
            title: true,
            sourceType: true,
            techDomain: true,
            aiTags: true,
          },
        },
        steps: { orderBy: { order: "asc" } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(tasks);
  } catch (error) {
    console.error("List practice tasks error:", error);
    return NextResponse.json(
      { error: "Failed to list practice tasks" },
      { status: 500 }
    );
  }
}
