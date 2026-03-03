import type { ParseResult } from '../../parser/index';
import type { NormalizedAgentIngestDecision } from './ingest-contract';

/**
 * Agent 处理选项
 * 统一的进度回调类型定义
 */
export interface AgentProcessOptions {
  onProgress?: (message: string) => void | Promise<void>;
}

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
  /** Phase 2a: 是否启用 AI SDK 工具调用模式 */
  useToolCalling: boolean;
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

export interface ToolCallTelemetry {
  toolCallId: string;
  toolName: string;
  success: boolean;
  durationMs: number;
  error?: string;
}

export interface ToolCallStats {
  total: number;
  success: number;
  failed: number;
  byTool: Record<string, {
    total: number;
    success: number;
    failed: number;
    durationMsTotal: number;
  }>;
}

export interface FallbackInfo {
  triggered: boolean;
  fromMode?: 'tool_calling';
  reason?: 'tool_calling_error';
  errorName?: string;
  errorMessage?: string;
}

export interface ReasoningTraceMetadata {
  startTime: string;
  endTime: string;
  iterations: number;
  toolsUsed: string[];
  // Phase 2a v2: 新增可选字段用于精确监控
  schemaVersion?: number;
  executionIntent?: 'tool_calling' | 'two_step';
  executionMode?: 'tool_calling' | 'two_step';
  twoStepReason?: 'tool_calling_disabled' | 'fallback_after_tool_error' | 'configured_two_step';
  fallback?: FallbackInfo;
  toolCallStats?: ToolCallStats;
}

export interface ReasoningTrace {
  entryId: string;
  input: ParseResult;
  steps: ReasoningStep[];
  finalResult: unknown;
  metadata: ReasoningTraceMetadata;
}

export interface AgentContext {
  input: ParseResult;
  evaluations: Record<string, unknown>;
  observations: string[];
  history: ReasoningStep[];
  intermediateResults: Record<string, unknown>;
}

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
    options?: AgentProcessOptions
  ): Promise<NormalizedAgentIngestDecision>;
}
