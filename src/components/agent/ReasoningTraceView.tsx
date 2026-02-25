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

interface ReasoningTraceViewProps {
  steps: ReasoningStep[];
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

export function ReasoningTraceView({ steps }: ReasoningTraceViewProps) {
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
