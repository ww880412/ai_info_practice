'use client';

import { useState } from 'react';

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
                  <pre className="mt-1 p-3 bg-muted rounded overflow-x-auto text-xs whitespace-pre-wrap max-h-60">
                    {step.observation}
                  </pre>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
