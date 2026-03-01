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

import type { NormalizedAgentIngestDecision } from './ingest-contract';

/**
 * Agent 引擎统一接口
 * 确保 v1 和 v2 实现兼容
 */
export interface IAgentEngine {
  /**
   * 处理条目并返回决策
   * @param entryId 条目 ID
   * @param input 解析后的输入
   * @param options 可选配置（进度回调等）
   */
  process(
    entryId: string,
    input: ParseResult,
    options?: {
      onProgress?: (message: string) => Promise<void>;
    }
  ): Promise<NormalizedAgentIngestDecision>;
}
