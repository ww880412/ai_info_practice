// Shared type for user-selected AI analysis mode
// null means auto (use env/default config)
export type AnalysisMode = 'two-step' | 'tool-calling' | null;

// Re-export Prisma types for convenience
export type {
  Entry,
  PracticeTask,
  PracticeStep,
} from "@prisma/client";

export {
  InputType,
  SourceType,
  ProcessStatus,
  ContentType,
  TechDomain,
  PracticeValue,
  PracticeStatus,
  StepStatus,
  Difficulty,
  KnowledgeStatus,
} from "@prisma/client";
