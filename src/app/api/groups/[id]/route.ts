import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const group = await prisma.group.findUnique({
      where: { id },
      include: {
        children: { include: { _count: { select: { entries: true } } } },
        entries: { select: { id: true, title: true, contentType: true, createdAt: true } },
        _count: { select: { entries: true } },
      },
    });
    if (!group) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }
    return NextResponse.json({ data: group });
  } catch {
    return NextResponse.json({ error: "Failed to fetch group" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { name } = body as { name: string };

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    const trimmedName = name.trim();

    const current = await prisma.group.findUnique({ where: { id }, select: { parentId: true } });
    if (!current) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    // Check uniqueness at same level
    if (current.parentId === null) {
      const conflict = await prisma.group.findFirst({
        where: { name: trimmedName, parentId: null, id: { not: id } },
      });
      if (conflict) {
        return NextResponse.json({ error: "Group name already exists at this level" }, { status: 409 });
      }
    }

    const updated = await prisma.group.update({
      where: { id },
      data: { name: trimmedName },
    });

    return NextResponse.json({ data: updated });
  } catch (err: unknown) {
    if (err && typeof err === "object" && "code" in err && (err as { code: string }).code === "P2002") {
      return NextResponse.json({ error: "Group name already exists at this level" }, { status: 409 });
    }
    return NextResponse.json({ error: "Failed to rename group" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const group = await prisma.group.findUnique({ where: { id } });
    if (!group) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    // Disconnect all entries before deleting (cascade handles children)
    await prisma.group.update({
      where: { id },
      data: { entries: { set: [] } },
    });

    await prisma.group.delete({ where: { id } });

    return NextResponse.json({ data: { success: true } });
  } catch {
    return NextResponse.json({ error: "Failed to delete group" }, { status: 500 });
  }
}
