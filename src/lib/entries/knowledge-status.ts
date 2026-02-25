import { KnowledgeStatus, ProcessStatus } from "@prisma/client";

// Valid state transitions
const VALID_TRANSITIONS: Record<KnowledgeStatus, KnowledgeStatus[]> = {
  PENDING: ["TO_REVIEW"],
  TO_REVIEW: ["ACTIVE"],
  ACTIVE: ["ARCHIVED", "DEPRECATED"],
  ARCHIVED: ["ACTIVE"],
  DEPRECATED: [],
};

/**
 * Check if a status transition is valid
 */
export function canTransition(
  from: KnowledgeStatus,
  to: KnowledgeStatus
): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Check if a status requires a reason
 */
export function requiresReason(status: KnowledgeStatus): boolean {
  return status === "DEPRECATED";
}

/**
 * Check if entry should auto-transition to TO_REVIEW
 */
export function shouldAutoTransitionToReview(
  processStatus: ProcessStatus
): boolean {
  return processStatus === "DONE";
}
