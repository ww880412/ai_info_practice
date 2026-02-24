/**
 * Tool-Feature-Comparison Component
 * 适用于工具推荐、资源收藏类内容
 */

interface ToolFeatureComparisonProps {
  data: {
    tool: string;
    features: string[];
    pros: string[];
    cons: string[];
    scenarios?: string[];
  };
}

export function ToolFeatureComparison({ data }: ToolFeatureComparisonProps) {
  return (
    <div className="space-y-4">
      {/* Tool name */}
      <div className="flex items-center gap-2">
        <h4 className="text-lg font-medium">{data.tool}</h4>
      </div>

      {/* Features */}
      {data.features && data.features.length > 0 && (
        <div>
          <h5 className="text-sm font-medium text-secondary mb-2">Features</h5>
          <ul className="grid grid-cols-1 gap-1">
            {data.features.map((feature, idx) => (
              <li key={idx} className="text-sm flex items-start gap-2">
                <span className="text-primary">•</span>
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Pros & Cons */}
      <div className="grid grid-cols-2 gap-4">
        {data.pros && data.pros.length > 0 && (
          <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <h5 className="text-sm font-medium text-green-700 dark:text-green-300 mb-2">Pros</h5>
            <ul className="space-y-1">
              {data.pros.map((pro, idx) => (
                <li key={idx} className="text-sm text-green-600 dark:text-green-400 flex items-start gap-1">
                  <span>+</span>
                  <span>{pro}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {data.cons && data.cons.length > 0 && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
            <h5 className="text-sm font-medium text-red-700 dark:text-red-300 mb-2">Cons</h5>
            <ul className="space-y-1">
              {data.cons.map((con, idx) => (
                <li key={idx} className="text-sm text-red-600 dark:text-red-400 flex items-start gap-1">
                  <span>-</span>
                  <span>{con}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Scenarios */}
      {data.scenarios && data.scenarios.length > 0 && (
        <div>
          <h5 className="text-sm font-medium text-secondary mb-2">Best Scenarios</h5>
          <div className="flex flex-wrap gap-1">
            {data.scenarios.map((scenario, idx) => (
              <span key={idx} className="text-xs px-2 py-1 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded">
                {scenario}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
