import { prisma } from "@/lib/prisma";
import type { ProcessStatus } from "@prisma/client";

export interface IngestTaskConfig {
  geminiApiKey?: string;
  geminiModel?: string;
}

type IngestTaskRunner = (
  entryId: string,
  config: IngestTaskConfig
) => Promise<void>;

interface QueuedTask {
  entryId: string;
  config: IngestTaskConfig;
  reason: "submit" | "recovery";
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

const ingestQueue: QueuedTask[] = [];
const queuedIds = new Set<string>();
const inFlightIds = new Set<string>();

let runner: IngestTaskRunner | null = null;
let queueLoopPromise: Promise<void> | null = null;
let recoveryTimer: NodeJS.Timeout | null = null;

const QUEUE_CONCURRENCY = parsePositiveInt(
  process.env.INGEST_QUEUE_CONCURRENCY,
  1
);
const STALE_RECOVERY_MS = parsePositiveInt(
  process.env.INGEST_STALE_RECOVERY_MS,
  3 * 60 * 1000
);
const RECOVERY_SCAN_INTERVAL_MS = parsePositiveInt(
  process.env.INGEST_RECOVERY_SCAN_INTERVAL_MS,
  60 * 1000
);

function shouldRecoverStatus(status: ProcessStatus): boolean {
  return status === "PARSING" || status === "AI_PROCESSING";
}

async function recoverStaleEntries(includeFreshPending = false) {
  const staleBefore = new Date(Date.now() - STALE_RECOVERY_MS);

  const stale = await prisma.entry.findMany({
    where: {
      OR: [
        {
          processStatus: "PENDING",
          ...(includeFreshPending ? {} : { updatedAt: { lt: staleBefore } }),
        },
        {
          processStatus: { in: ["PARSING", "AI_PROCESSING"] },
          updatedAt: { lt: staleBefore },
        },
      ],
    },
    select: {
      id: true,
      processStatus: true,
    },
  });

  for (const entry of stale) {
    if (shouldRecoverStatus(entry.processStatus)) {
      await prisma.entry
        .update({
          where: { id: entry.id },
          data: {
            processStatus: "PENDING",
            processError: "任务恢复中，重新排队...",
          },
        })
        .catch(() => {});
    }

    enqueueIngestTask(entry.id, {}, "recovery");
  }
}

async function runSingleTask(task: QueuedTask) {
  if (!runner) {
    throw new Error("Ingest queue runner is not initialized");
  }

  inFlightIds.add(task.entryId);
  try {
    await runner(task.entryId, task.config);
  } catch (error) {
    console.error(
      `[ingest-queue] task failed (${task.reason}) for ${task.entryId}:`,
      error
    );
  } finally {
    inFlightIds.delete(task.entryId);
    queuedIds.delete(task.entryId);
  }
}

async function queueLoop() {
  while (ingestQueue.length > 0) {
    const batch = ingestQueue.splice(0, QUEUE_CONCURRENCY);
    await Promise.all(batch.map((task) => runSingleTask(task)));
  }
}

function ensureQueueLoop() {
  if (queueLoopPromise) return;

  queueLoopPromise = queueLoop()
    .catch((error) => {
      console.error("[ingest-queue] queue loop crashed:", error);
    })
    .finally(() => {
      queueLoopPromise = null;
      if (ingestQueue.length > 0) {
        ensureQueueLoop();
      }
    });
}

export function initializeIngestQueue(taskRunner: IngestTaskRunner) {
  runner = taskRunner;

  if (!recoveryTimer) {
    recoveryTimer = setInterval(() => {
      void recoverStaleEntries(false).catch((error) => {
        console.error("[ingest-queue] stale recovery failed:", error);
      });
    }, RECOVERY_SCAN_INTERVAL_MS);

    // Startup should recover all pending tasks immediately, not only stale ones.
    void recoverStaleEntries(true).catch((error) => {
      console.error("[ingest-queue] initial recovery failed:", error);
    });
  }
}

export function enqueueIngestTask(
  entryId: string,
  config: IngestTaskConfig,
  reason: "submit" | "recovery" = "submit"
): boolean {
  if (queuedIds.has(entryId) || inFlightIds.has(entryId)) {
    return false;
  }

  ingestQueue.push({ entryId, config, reason });
  queuedIds.add(entryId);
  ensureQueueLoop();
  return true;
}

export function getIngestQueueSnapshot() {
  return {
    queued: ingestQueue.map((task) => task.entryId),
    inFlight: Array.from(inFlightIds),
    queueLength: ingestQueue.length,
  };
}
