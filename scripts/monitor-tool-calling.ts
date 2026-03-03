/**
 * Phase 2a v2: 工具调用监控脚本
 * 基于 Codex 评审修正版 - 修复口径、分母、回退率公式
 */
import { prisma } from '../src/lib/prisma';
import type { ReasoningTraceMetadata, ToolCallStats, FallbackInfo } from '../src/lib/ai/agent/types';

// ============ 类型定义 ============

interface ReasoningStepContext {
  stepType?: 'tool_call' | 'reasoning';
  toolCallCount?: number;
  durationMs?: number;
  toolCalls?: Array<{
    toolCallId: string;
    toolName: string;
    success: boolean;
    durationMs: number;
  }>;
}

interface ReasoningStep {
  step: number;
  timestamp: string;
  action: string;
  observation?: string;
  context?: ReasoningStepContext;
}

interface TraceMode {
  executionIntent: 'tool_calling' | 'two_step' | 'unknown';
  executionMode: 'tool_calling' | 'two_step' | 'unknown';
  fallbackTriggered: boolean;
  twoStepReason: string | null;
  isLegacyData: boolean;
}

interface RateWithDenominator {
  rate: number;
  numerator: number;
  denominator: number;
}

interface MonitorReport {
  period: { start: Date; end: Date };
  totalTraces: number;
  totalEntriesLatest: number;

  // 运行级指标（trace 粒度）
  toolCallingModeRate: RateWithDenominator;
  twoStepModeRate: RateWithDenominator;
  fallbackRate: RateWithDenominator;
  twoStepConfiguredRate: RateWithDenominator;

  // 调用级指标
  toolCallSuccessRate: RateWithDenominator;
  avgToolCallsPerRun: number;
  toolCallDurationP50: number;
  toolCallDurationP95: number;

  // 频率与覆盖率
  toolCallFrequencyDistribution: Record<string, number>;
  toolCoverageDistribution: Record<string, number>;

  // 成功率（Entry 级，辅助参考）
  entrySuccessRate: RateWithDenominator;

  // 数据质量
  legacyAmbiguousTwoStepCount: number;
  missingToolDurationCount: number;
}

const SDK_TOOLS = [
  'classify_content',
  'extract_summary',
  'extract_code',
  'extract_version',
  'check_duplicate',
  'route_to_strategy',
  'evaluate_dimension',
];

const TWO_STEP_MARKERS = ['llm_step_1', 'llm_step_2'];

// ============ 工具函数 ============

function parseJsonSafely<T>(str: string | null | undefined): T | null {
  if (!str) return null;
  try {
    return JSON.parse(str) as T;
  } catch {
    return null;
  }
}

function percentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

function ratio(numerator: number, denominator: number): RateWithDenominator {
  return {
    rate: denominator > 0 ? numerator / denominator : 0,
    numerator,
    denominator,
  };
}

// ============ 解析逻辑 ============

/**
 * 解析 trace 的执行模式（兼容新旧数据）
 */
function parseTraceMode(metadata: ReasoningTraceMetadata | null, toolsUsed: string[]): TraceMode {
  // 新数据：优先读显式字段
  if (metadata?.schemaVersion === 2) {
    return {
      executionIntent: metadata.executionIntent || 'unknown',
      executionMode: metadata.executionMode || 'unknown',
      fallbackTriggered: metadata.fallback?.triggered ?? false,
      twoStepReason: metadata.twoStepReason || null,
      isLegacyData: false,
    };
  }

  // 旧数据：推断
  const hasSDKTools = toolsUsed.some(t => SDK_TOOLS.includes(t));
  const hasTwoStepMarkers = toolsUsed.some(t => TWO_STEP_MARKERS.includes(t));

  if (hasSDKTools) {
    return {
      executionIntent: 'tool_calling',
      executionMode: 'tool_calling',
      fallbackTriggered: false,
      twoStepReason: null,
      isLegacyData: true,
    };
  }

  if (hasTwoStepMarkers) {
    return {
      executionIntent: 'unknown', // 无法区分是配置关闭还是回退
      executionMode: 'two_step',
      fallbackTriggered: false, // 无法确定
      twoStepReason: null,
      isLegacyData: true,
    };
  }

  return {
    executionIntent: 'unknown',
    executionMode: 'unknown',
    fallbackTriggered: false,
    twoStepReason: null,
    isLegacyData: true,
  };
}

/**
 * 提取工具调用详情
 */
function extractToolCalls(
  steps: ReasoningStep[],
  metadata: ReasoningTraceMetadata | null
): Array<{ toolName: string; success: boolean; durationMs: number | null }> {
  const calls: Array<{ toolName: string; success: boolean; durationMs: number | null }> = [];

  // 优先从新字段读取
  if (metadata?.toolCallStats) {
    const stats = metadata.toolCallStats;
    for (const [toolName, toolStats] of Object.entries(stats.byTool)) {
      for (let i = 0; i < toolStats.success; i++) {
        calls.push({
          toolName,
          success: true,
          durationMs: toolStats.total > 0 ? toolStats.durationMsTotal / toolStats.total : null,
        });
      }
      for (let i = 0; i < toolStats.failed; i++) {
        calls.push({
          toolName,
          success: false,
          durationMs: toolStats.total > 0 ? toolStats.durationMsTotal / toolStats.total : null,
        });
      }
    }
    return calls;
  }

  // 从 step.context.toolCalls 读取
  for (const step of steps) {
    if (step.context?.toolCalls) {
      for (const tc of step.context.toolCalls) {
        calls.push({
          toolName: tc.toolName,
          success: tc.success,
          durationMs: tc.durationMs,
        });
      }
    }
  }

  // 兼容旧数据：从 observation 解析
  if (calls.length === 0) {
    for (const step of steps) {
      if (step.observation) {
        const obs = parseJsonSafely<Array<{ toolName?: string; output?: { success?: boolean } }>>(step.observation);
        if (Array.isArray(obs)) {
          for (const item of obs) {
            if (item.toolName) {
              calls.push({
                toolName: item.toolName,
                success: item.output?.success !== false,
                durationMs: null,
              });
            }
          }
        }
      }
    }
  }

  return calls;
}

function calculateLatency(metadata: ReasoningTraceMetadata): number {
  const start = new Date(metadata.startTime).getTime();
  const end = new Date(metadata.endTime).getTime();
  return end - start;
}

// ============ 报告生成 ============

async function generateMonitorReport(days: number = 1): Promise<MonitorReport> {
  const end = new Date();
  const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);

  // 查询时间范围内的 traces，关联 Entry
  const traces = await prisma.reasoningTrace.findMany({
    where: {
      createdAt: { gte: start, lte: end },
    },
    include: {
      entry: {
        select: {
          id: true,
          processStatus: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  // 统计变量
  let toolCallingRuns = 0;
  let twoStepRuns = 0;
  let toolCallingAttemptRuns = 0;
  let fallbackRuns = 0;
  let twoStepConfiguredRuns = 0;
  let legacyAmbiguousTwoStepCount = 0;

  let totalToolCalls = 0;
  let successfulToolCalls = 0;
  const toolCallDurations: number[] = [];
  let missingToolDurationCount = 0;

  const toolCallFrequency: Record<string, number> = {};
  const toolCoverage: Record<string, Set<string>> = {};

  let doneCount = 0;
  let failedCount = 0;

  // 按 entryId 去重用于辅助视图
  const latestByEntry = new Map<string, typeof traces[0]>();

  for (const trace of traces) {
    if (!latestByEntry.has(trace.entryId)) {
      latestByEntry.set(trace.entryId, trace);
    }

    const metadata = parseJsonSafely<ReasoningTraceMetadata>(trace.metadata);
    const steps = parseJsonSafely<ReasoningStep[]>(trace.steps) || [];
    const toolsUsed = metadata?.toolsUsed || [];

    // 解析执行模式
    const mode = parseTraceMode(metadata, toolsUsed);

    if (mode.executionMode === 'tool_calling') {
      toolCallingRuns++;
    } else if (mode.executionMode === 'two_step') {
      twoStepRuns++;
    }

    if (mode.executionIntent === 'tool_calling') {
      toolCallingAttemptRuns++;
    }

    if (mode.fallbackTriggered) {
      fallbackRuns++;
    }

    if (mode.twoStepReason === 'tool_calling_disabled') {
      twoStepConfiguredRuns++;
    }

    if (mode.isLegacyData && mode.executionMode === 'two_step') {
      legacyAmbiguousTwoStepCount++;
    }

    // 提取工具调用
    const calls = extractToolCalls(steps, metadata);
    for (const call of calls) {
      totalToolCalls++;
      if (call.success) successfulToolCalls++;

      // 频率统计
      toolCallFrequency[call.toolName] = (toolCallFrequency[call.toolName] || 0) + 1;

      // 覆盖率统计
      if (!toolCoverage[call.toolName]) {
        toolCoverage[call.toolName] = new Set();
      }
      toolCoverage[call.toolName].add(trace.id);

      // 时延统计
      if (call.durationMs != null && call.durationMs > 0) {
        toolCallDurations.push(call.durationMs);
      } else {
        missingToolDurationCount++;
      }
    }

    // Entry 成功率
    const status = trace.entry?.processStatus;
    if (status === 'DONE') doneCount++;
    else if (status === 'FAILED') failedCount++;
  }

  const total = traces.length;
  const validToolCallingRuns = toolCallingRuns > 0 ? toolCallingRuns : 1;

  // 构建覆盖率分布
  const toolCoverageDistribution: Record<string, number> = {};
  for (const [tool, traceIds] of Object.entries(toolCoverage)) {
    toolCoverageDistribution[tool] = traceIds.size;
  }

  return {
    period: { start, end },
    totalTraces: total,
    totalEntriesLatest: latestByEntry.size,

    toolCallingModeRate: ratio(toolCallingRuns, total),
    twoStepModeRate: ratio(twoStepRuns, total),
    fallbackRate: ratio(fallbackRuns, toolCallingAttemptRuns),
    twoStepConfiguredRate: ratio(twoStepConfiguredRuns, total),

    toolCallSuccessRate: ratio(successfulToolCalls, totalToolCalls),
    avgToolCallsPerRun: validToolCallingRuns > 0 ? totalToolCalls / validToolCallingRuns : 0,
    toolCallDurationP50: percentile(toolCallDurations, 50),
    toolCallDurationP95: percentile(toolCallDurations, 95),

    toolCallFrequencyDistribution: toolCallFrequency,
    toolCoverageDistribution,

    entrySuccessRate: ratio(doneCount, total),

    legacyAmbiguousTwoStepCount,
    missingToolDurationCount,
  };
}

// ============ 报告格式化 ============

function formatRate(r: RateWithDenominator): string {
  return `${(r.rate * 100).toFixed(1)}% (${r.numerator}/${r.denominator})`;
}

function formatReport(report: MonitorReport): string {
  const lines: string[] = [
    '',
    '===== 工具调用监控报告 (v2) =====',
    `时间范围: ${report.period.start.toISOString().slice(0, 16)} ~ ${report.period.end.toISOString().slice(0, 16)}`,
    `统计 trace 数: ${report.totalTraces} (去重 entry 数: ${report.totalEntriesLatest})`,
    '',
    '== 运行级指标 (trace 粒度) ==',
    `  工具调用模式: ${formatRate(report.toolCallingModeRate)}`,
    `  两步模式: ${formatRate(report.twoStepModeRate)}`,
    `  回退率: ${formatRate(report.fallbackRate)}`,
    `  配置关闭工具调用: ${formatRate(report.twoStepConfiguredRate)}`,
    '',
    '== 调用级指标 (tool call 粒度) ==',
    `  工具调用成功率: ${formatRate(report.toolCallSuccessRate)}`,
    `  平均每次工具调用数: ${report.avgToolCallsPerRun.toFixed(1)}`,
    `  工具调用时延 P50: ${report.toolCallDurationP50.toLocaleString()}ms`,
    `  工具调用时延 P95: ${report.toolCallDurationP95.toLocaleString()}ms`,
    '',
    '== 工具调用频率 (调用次数) ==',
  ];

  const sortedFreq = Object.entries(report.toolCallFrequencyDistribution)
    .sort((a, b) => b[1] - a[1]);
  for (const [tool, count] of sortedFreq) {
    lines.push(`  ${tool}: ${count}`);
  }

  lines.push('');
  lines.push('== 工具覆盖率 (trace 数) ==');
  const sortedCoverage = Object.entries(report.toolCoverageDistribution)
    .sort((a, b) => b[1] - a[1]);
  for (const [tool, count] of sortedCoverage) {
    const pct = ((count / report.totalTraces) * 100).toFixed(0);
    lines.push(`  ${tool}: ${count} (${pct}%)`);
  }

  lines.push('');
  lines.push('== Entry 处理状态 (辅助参考) ==');
  lines.push(`  成功 (DONE): ${formatRate(report.entrySuccessRate)}`);

  lines.push('');
  lines.push('== 数据质量 ==');
  lines.push(`  旧数据（无法区分回退）: ${report.legacyAmbiguousTwoStepCount}`);
  lines.push(`  缺失工具时延: ${report.missingToolDurationCount}`);

  lines.push('');
  lines.push('== 建议 ==');

  if (report.toolCallSuccessRate.denominator > 0 && report.toolCallSuccessRate.rate >= 0.95) {
    lines.push('  ✅ 工具调用成功率达标 (≥95%)');
  } else if (report.toolCallSuccessRate.denominator > 0) {
    lines.push('  ⚠️ 工具调用成功率偏低，建议检查失败工具');
  }

  if (report.fallbackRate.denominator > 0 && report.fallbackRate.rate <= 0.1) {
    lines.push('  ✅ 回退率正常 (≤10%)');
  } else if (report.fallbackRate.denominator > 0 && report.fallbackRate.rate > 0.1) {
    lines.push('  ⚠️ 回退率偏高 (>10%)，建议检查工具调用稳定性');
  }

  if (report.toolCallDurationP95 > 0 && report.toolCallDurationP95 <= 5000) {
    lines.push('  ✅ 工具调用时延正常 (P95 ≤5s)');
  } else if (report.toolCallDurationP95 > 5000) {
    lines.push('  ⚠️ 工具调用 P95 时延偏高 (>5s)');
  }

  if (report.legacyAmbiguousTwoStepCount > 0) {
    lines.push(`  ⚠️ 有 ${report.legacyAmbiguousTwoStepCount} 条旧数据无法区分回退原因`);
  }

  return lines.join('\n');
}

// ============ 主函数 ============

async function main() {
  const daysArg = process.argv[2];
  const days = daysArg ? parseInt(daysArg, 10) : 1;

  if (isNaN(days) || days <= 0) {
    console.error('用法: npm run monitor:tools [天数]');
    console.error('示例: npm run monitor:tools 7');
    process.exitCode = 1;
    return;
  }

  console.log(`正在生成最近 ${days} 天的监控报告...`);

  try {
    const report = await generateMonitorReport(days);
    console.log(formatReport(report));
  } catch (error) {
    console.error('生成报告失败:', error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();
