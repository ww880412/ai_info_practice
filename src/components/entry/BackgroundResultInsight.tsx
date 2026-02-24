/**
 * Background-Result-Insight Component
 * 适用于案例分析、经验分享类内容
 */

interface BackgroundResultInsightProps {
  data: {
    background: string;
    result: string;
    insights: string[];
  };
}

export function BackgroundResultInsight({ data }: BackgroundResultInsightProps) {
  return (
    <div className="space-y-4">
      {/* Background */}
      <div>
        <h4 className="text-sm font-medium text-secondary mb-1">Background</h4>
        <p className="text-sm">{data.background}</p>
      </div>

      {/* Result */}
      <div>
        <h4 className="text-sm font-medium text-secondary mb-1">Result</h4>
        <p className="text-sm">{data.result}</p>
      </div>

      {/* Insights */}
      {data.insights && data.insights.length > 0 && (
        <div>
          <h4 className="text-sm font-medium mb-2">Key Insights</h4>
          <ul className="space-y-2">
            {data.insights.map((insight, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 text-xs flex items-center justify-center mt-0.5">
                  {idx + 1}
                </span>
                <span className="text-sm">{insight}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
