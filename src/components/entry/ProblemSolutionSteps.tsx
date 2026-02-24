/**
 * Problem-Solution-Steps Component
 * 适用于教程、最佳实践类内容
 */

interface Step {
  order: number;
  title: string;
  description?: string;
}

interface ProblemSolutionData {
  problem: string;
  solution: string;
  steps: Step[];
  tips?: string;
}

interface ProblemSolutionStepsProps {
  data: ProblemSolutionData;
}

export function ProblemSolutionSteps({ data }: ProblemSolutionStepsProps) {
  return (
    <div className="space-y-4">
      {/* Problem */}
      <div>
        <h4 className="text-sm font-medium text-secondary mb-1">Problem</h4>
        <p className="text-sm">{data.problem}</p>
      </div>

      {/* Solution */}
      <div>
        <h4 className="text-sm font-medium text-secondary mb-1">Solution</h4>
        <p className="text-sm">{data.solution}</p>
      </div>

      {/* Steps */}
      {data.steps && data.steps.length > 0 && (
        <div>
          <h4 className="text-sm font-medium mb-2">Steps</h4>
          <ol className="space-y-2">
            {data.steps.map((step, idx) => (
              <li key={idx} className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-medium flex items-center justify-center">
                  {step.order || idx + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{step.title}</p>
                  {step.description && (
                    <p className="text-xs text-secondary mt-0.5">{step.description}</p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Tips */}
      {data.tips && (
        <div className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
          <h4 className="text-sm font-medium text-yellow-800 dark:text-yellow-200 mb-1">Tips</h4>
          <p className="text-sm text-yellow-700 dark:text-yellow-300">{data.tips}</p>
        </div>
      )}
    </div>
  );
}
