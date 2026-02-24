import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

interface GroupNode {
  id: string;
  name: string;
  parentId: string | null;
  entryCount: number;
  children: GroupNode[];
  createdAt: Date;
  updatedAt: Date;
}

async function getGroupDepth(groupId: string): Promise<number> {
  let depth = 0;
  let currentId: string | null = groupId;
  while (currentId) {
    const found: { parentId: string | null } | null = await prisma.group.findUnique({
      where: { id: currentId },
      select: { parentId: true },
    });
    if (!found || !found.parentId) break;
    currentId = found.parentId;
    depth++;
  }
  return depth;
}

function buildTree(
  flat: Array<{ id: string; name: string; parentId: string | null; createdAt: Date; updatedAt: Date; _count: { entries: number } }>,
  parentId: string | null = null
): GroupNode[] {
  return flat
    .filter((g) => g.parentId === parentId)
    .map((g) => ({
      id: g.id,
      name: g.name,
      parentId: g.parentId,
      entryCount: g._count.entries,
      createdAt: g.createdAt,
      updatedAt: g.updatedAt,
      children: buildTree(flat, g.id),
    }));
}

export async function GET() {
  try {
    const allGroups = await prisma.group.findMany({
      include: { _count: { select: { entries: true } } },
      orderBy: { name: "asc" },
    });
    const tree = buildTree(allGroups);
    return NextResponse.json({ data: tree });
  } catch {
    return NextResponse.json({ error: "Failed to fetch groups" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, parentId } = body as { name: string; parentId?: string };

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    const trimmedName = name.trim();

    if (parentId) {
      const parent = await prisma.group.findUnique({ where: { id: parentId } });
      if (!parent) {
        return NextResponse.json({ error: "Parent group not found" }, { status: 404 });
      }
      const parentDepth = await getGroupDepth(parentId);
      if (parentDepth >= 2) {
        return NextResponse.json({ error: "Maximum nesting depth (2 levels) exceeded" }, { status: 400 });
      }
    } else {
      const existing = await prisma.group.findFirst({ where: { name: trimmedName, parentId: null } });
      if (existing) {
        return NextResponse.json({ error: "Top-level group name must be unique" }, { status: 409 });
      }
    }

    const group = await prisma.group.create({
      data: { name: trimmedName, parentId: parentId ?? null },
    });

    return NextResponse.json({ data: group }, { status: 201 });
  } catch (err: unknown) {
    if (err && typeof err === "object" && "code" in err && (err as { code: string }).code === "P2002") {
      return NextResponse.json({ error: "Group name already exists at this level" }, { status: 409 });
    }
    return NextResponse.json({ error: "Failed to create group" }, { status: 500 });
  }
}
