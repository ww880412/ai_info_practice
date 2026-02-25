import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { KnowledgeStatus } from "@prisma/client";
import { canTransition, requiresReason } from "@/lib/entries/knowledge-status";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();
    const { status, reason } = body;

    // Validate status
    if (!status || typeof status !== "string") {
      return NextResponse.json(
        { error: "status is required" },
        { status: 400 }
      );
    }

    const validStatuses: KnowledgeStatus[] = [
      "PENDING",
      "TO_REVIEW",
      "ACTIVE",
      "ARCHIVED",
      "DEPRECATED",
    ];

    if (!validStatuses.includes(status as KnowledgeStatus)) {
      return NextResponse.json(
        { error: "Invalid status value" },
        { status: 400 }
      );
    }

    const targetStatus = status as KnowledgeStatus;

    // Get current entry
    const entry = await prisma.entry.findUnique({
      where: { id },
      select: { knowledgeStatus: true },
    });

    if (!entry) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }

    // Check transition validity
    if (!canTransition(entry.knowledgeStatus, targetStatus)) {
      return NextResponse.json(
        {
          error: `Cannot transition from ${entry.knowledgeStatus} to ${targetStatus}`,
        },
        { status: 400 }
      );
    }

    // Check reason requirement
    if (requiresReason(targetStatus) && !reason) {
      return NextResponse.json(
        { error: "reason is required for DEPRECATED status" },
        { status: 400 }
      );
    }

    // Build update data
    const updateData: {
      knowledgeStatus: KnowledgeStatus;
      reviewedAt?: Date | null;
      archivedAt?: Date | null;
      deprecatedReason?: string | null;
    } = {
      knowledgeStatus: targetStatus,
    };

    if (targetStatus === "ACTIVE") {
      updateData.reviewedAt = new Date();
      updateData.archivedAt = null;
    } else if (targetStatus === "ARCHIVED") {
      updateData.archivedAt = new Date();
    } else if (targetStatus === "DEPRECATED") {
      updateData.deprecatedReason = reason;
    }

    // Update entry
    const updatedEntry = await prisma.entry.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ data: updatedEntry });
  } catch (error) {
    console.error("Update entry status error:", error);
    return NextResponse.json(
      { error: "Failed to update entry status" },
      { status: 500 }
    );
  }
}
