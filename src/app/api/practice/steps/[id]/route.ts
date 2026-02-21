import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * PATCH /api/practice/steps/[id] - Update a practice step status.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { status, note } = body;

    if (!status) {
      return NextResponse.json({ error: "status is required" }, { status: 400 });
    }

    // Get current step to check if status actually changed
    const currentStep = await prisma.practiceStep.findUnique({ where: { id } });
    if (!currentStep) {
      return NextResponse.json({ error: "Step not found" }, { status: 404 });
    }

    const statusChanged = currentStep.status !== status;
    const updateData: Record<string, unknown> = {};

    // Only update status if provided and changed
    if (status && statusChanged) {
      updateData.status = status;
    }
    if (note !== undefined) updateData.note = note;

    // Only set timestamps when status actually changes (not for note-only updates)
    if (statusChanged && status === "IN_PROGRESS") {
      updateData.startedAt = new Date();
    } else if (statusChanged && status === "COMPLETED") {
      updateData.completedAt = new Date();
    }

    const step = await prisma.practiceStep.update({
      where: { id },
      data: updateData,
    });

    // Auto-update parent task status
    const allSteps = await prisma.practiceStep.findMany({
      where: { practiceTaskId: step.practiceTaskId },
    });

    const allDone = allSteps.every(
      (s: { status: string }) => s.status === "COMPLETED" || s.status === "SKIPPED"
    );
    const anyInProgress = allSteps.some((s: { status: string }) => s.status === "IN_PROGRESS");

    let taskStatus: "QUEUED" | "IN_PROGRESS" | "COMPLETED" = "QUEUED";
    if (allDone) taskStatus = "COMPLETED";
    else if (anyInProgress || allSteps.some((s: { status: string }) => s.status === "COMPLETED"))
      taskStatus = "IN_PROGRESS";

    // Get current task to check if timestamps should be set
    const currentTask = await prisma.practiceTask.findUnique({
      where: { id: step.practiceTaskId },
    });

    const taskUpdate: Record<string, unknown> = { status: taskStatus };
    // Only set task startedAt if status changed to IN_PROGRESS and not already set
    if (taskStatus === "IN_PROGRESS" && currentTask && !currentTask.startedAt) {
      taskUpdate.startedAt = new Date();
    }
    if (taskStatus === "COMPLETED" && currentTask && !currentTask.completedAt) {
      taskUpdate.completedAt = new Date();
    }

    await prisma.practiceTask.update({
      where: { id: step.practiceTaskId },
      data: taskUpdate,
    });

    return NextResponse.json(step);
  } catch (error) {
    console.error("Update step error:", error);
    return NextResponse.json(
      { error: "Failed to update step" },
      { status: 500 }
    );
  }
}
