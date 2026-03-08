'use client';

import { useState } from 'react';
import { parseObservation } from '@/lib/trace/observation';

interface ReasoningStep {
  step: number;
  thought: string;
  action: string;
  observation: string;
  reasoning: string;
}

interface TraceMetadata {
  executionIntent?: 'tool_calling' | 'two_step';
  executionMode?: 'tool_calling' | 'two_step';
  twoStepReason?: 'tool_calling_disabled' | 'fallback_after_tool_error' | 'configured_two_step';
  fallback?: {
    triggered?: boolean;
    fromMode?: 'tool_calling';
    reason?: 'tool_calling_error';
    errorName?: string;
    errorMessage?: string;
  };
  toolCallStats?: {
    total?: number;
    success?: number;
    failed?: number;
    byTool?: Record<string, unknown>;
  };
}

interface ReasoningTraceViewProps {
  steps: ReasoningStep[];
  metadata?: TraceMetadata | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function renderPrimitive(value: unknown) {
  if (typeof value === 'string') {
    return <span className="text-green-700 dark:text-green-300 break-all">{`"${value}"`}</span>;
  }
  if (typeof value === 'number') {
    return <span className="text-blue-700 dark:text-blue-300">{value}</span>;
  }
  if (typeof value === 'boolean') {
    return <span className="text-purple-700 dark:text-purple-300">{String(value)}</span>;
  }
  if (value === null) {
    return <span className="text-secondary">null</span>;
  }
  return <span className="text-foreground">{String(value)}</span>;
}

function JsonTreeNode({ label, value, depth }: { label?: string; value: unknown; depth: number }) {
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return (
        <div className="text-xs font-mono leading-6">
          {label ? <span className="text-secondary mr-1">{label}:</span> : null}
          <span>[]</span>
        </div>
      );
    }

    return (
      <details open={depth < 1} className="text-xs font-mono">
        <summary className="cursor-pointer leading-6">
          {label ? <span className="text-secondary mr-1">{label}:</span> : null}
          <span className="text-primary">Array({value.length})</span>
        </summary>
        <div className="pl-3 ml-1 border-l border-border/60 space-y-1">
          {value.map((item, index) => (
            <JsonTreeNode
              key={`${depth}-${index}`}
              label={String(index)}
              value={item}
              depth={depth + 1}
            />
          ))}
        </div>
      </details>
    );
  }

  if (isRecord(value)) {
    const entries = Object.entries(value);
    if (entries.length === 0) {
      return (
        <div className="text-xs font-mono leading-6">
          {label ? <span className="text-secondary mr-1">{label}:</span> : null}
          <span>{"{}"}</span>
        </div>
      );
    }

    return (
      <details open={depth < 1} className="text-xs font-mono">
        <summary className="cursor-pointer leading-6">
          {label ? <span className="text-secondary mr-1">{label}:</span> : null}
          <span className="text-primary">Object({entries.length})</span>
        </summary>
        <div className="pl-3 ml-1 border-l border-border/60 space-y-1">
          {entries.map(([key, item]) => (
            <JsonTreeNode key={`${depth}-${key}`} label={key} value={item} depth={depth + 1} />
          ))}
        </div>
      </details>
    );
  }

  return (
    <div className="text-xs font-mono leading-6">
      {label ? <span className="text-secondary mr-1">{label}:</span> : null}
      {renderPrimitive(value)}
    </div>
  );
}

function ObservationView({ raw }: { raw: string }) {
  const parsed = parseObservation(raw);
  const isStructured = Array.isArray(parsed) || isRecord(parsed);

  if (!isStructured) {
    return (
      <pre className="mt-1 p-3 bg-muted rounded overflow-x-auto text-xs whitespace-pre-wrap break-words">
        {raw}
      </pre>
    );
  }

  return (
    <div className="mt-1 p-3 bg-muted rounded overflow-auto">
      <JsonTreeNode value={parsed} depth={0} />
    </div>
  );
}

function formatExecutionMode(value?: 'tool_calling' | 'two_step') {
  if (value === 'tool_calling') return 'Tool Calling';
  if (value === 'two_step') return 'Two Step';
  return 'Unknown';
}

export function ReasoningTraceView({ steps, metadata }: ReasoningTraceViewProps) {
  const [expandedStep, setExpandedStep] = useState<number | null>(null);

  if (!steps || steps.length === 0) {
    return (
      <div className="text-muted-foreground text-sm">
        暂无推理过程
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {metadata && (
        <div className="space-y-3">
          <div className="grid gap-3 md:grid-cols-4">
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Intent</div>
              <div className="mt-1 text-sm font-medium">{formatExecutionMode(metadata.executionIntent)}</div>
            </div>
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Actual Mode</div>
              <div className="mt-1 text-sm font-medium">{formatExecutionMode(metadata.executionMode)}</div>
            </div>
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Fallback Reason</div>
              <div className="mt-1 text-sm font-medium">{metadata.twoStepReason || 'none'}</div>
            </div>
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Tool Calls</div>
              <div className="mt-1 text-sm font-medium">
                {metadata.toolCallStats
                  ? `${metadata.toolCallStats.total ?? 0} / ${metadata.toolCallStats.success ?? 0} / ${metadata.toolCallStats.failed ?? 0}`
                  : '0 / 0 / 0'}
              </div>
            </div>
          </div>

          {metadata.fallback?.triggered && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-900/50 dark:bg-amber-950/20">
              <div className="font-medium text-amber-800 dark:text-amber-200">
                Fallback triggered
              </div>
              {metadata.fallback.errorName && (
                <div className="mt-1 text-amber-900 dark:text-amber-100">
                  {metadata.fallback.errorName}
                </div>
              )}
              {metadata.fallback.errorMessage && (
                <div className="mt-1 text-amber-800/90 dark:text-amber-200/90">
                  {metadata.fallback.errorMessage}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <h3 className="font-semibold text-lg">推理过程</h3>

      <div className="space-y-2">
        {steps.map((step, index) => (
          <div
            key={step.step}
            className="border rounded-lg overflow-hidden bg-card"
          >
            <button
              onClick={() => setExpandedStep(expandedStep === index ? null : index)}
              className="w-full px-4 py-3 text-left bg-muted/50 hover:bg-muted flex items-center gap-3 transition-colors"
            >
              <span className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 text-primary text-sm font-medium flex items-center justify-center">
                {step.step}
              </span>
              <span className="text-sm truncate flex-1">
                {step.thought || step.reasoning || '推理中...'}
              </span>
              <span className="text-muted-foreground text-xs">
                {expandedStep === index ? '▲' : '▼'}
              </span>
            </button>

            {expandedStep === index && (
              <div className="p-4 space-y-4 text-sm border-t">
                <div>
                  <span className="font-medium text-muted-foreground">思考：</span>
                  <p className="mt-1 whitespace-pre-wrap">{step.thought}</p>
                </div>

                <div>
                  <span className="font-medium text-muted-foreground">动作：</span>
                  <code className="ml-2 px-2 py-1 bg-muted rounded text-xs">
                    {step.action || '无'}
                  </code>
                </div>

                <div>
                  <span className="font-medium text-muted-foreground">理由：</span>
                  <p className="mt-1 whitespace-pre-wrap">{step.reasoning}</p>
                </div>

                <div>
                  <span className="font-medium text-muted-foreground">观察：</span>
                  <ObservationView raw={step.observation} />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
