import type { ParseResult } from '../../parser/index';

export interface EvaluationDimension {
  id: string;
  name: string;
  description: string;
  prompt: string;
  weight?: number;
  enabled: boolean;
}

export interface ProcessingStrategy {
  type: 'NOTE' | 'PRACTICE' | 'COLLECTION' | 'RESEARCH' | 'DISCARD';
  name: string;
  description: string;
  condition: string;
  outputSchema: object;
}

export interface AgentConfig {
  evaluationDimensions: EvaluationDimension[];
  processingStrategies: ProcessingStrategy[];
  availableTools: string[];
  maxIterations: number;
}

export interface ReasoningStep {
  step: number;
  timestamp: string;
  thought: string;
  action: string;
  observation: string;
  reasoning: string;
  context: Record<string, unknown>;
  error?: string;
}

export interface ReasoningTrace {
  entryId: string;
  input: ParseResult;
  steps: ReasoningStep[];
  finalResult: unknown;
  metadata: {
    startTime: string;
    endTime: string;
    iterations: number;
    toolsUsed: string[];
  };
}

export interface AgentContext {
  input: ParseResult;
  evaluations: Record<string, unknown>;
  observations: string[];
  history: ReasoningStep[];
  intermediateResults: Record<string, unknown>;
}
