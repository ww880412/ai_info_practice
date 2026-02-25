import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q");

    if (!q || !q.trim()) {
      return NextResponse.json({ data: [] });
    }

    const query = q.trim();

    const entries = await prisma.entry.findMany({
      where: {
        OR: [
          { title: { contains: query, mode: "insensitive" } },
          { coreSummary: { contains: query, mode: "insensitive" } },
          { aiTags: { hasSome: [query] } },
        ],
      },
      select: {
        id: true,
        title: true,
        coreSummary: true,
        aiTags: true,
      },
      take: 20,
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({ data: entries });
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json(
      { error: "Search failed" },
      { status: 500 }
    );
  }
}
