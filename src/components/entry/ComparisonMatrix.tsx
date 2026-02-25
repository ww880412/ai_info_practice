/**
 * Comparison Matrix Component
 * Renders comparison table with items as rows and dimensions as columns
 */

interface ComparisonItem {
  name: string;
  description?: string;
}

interface ComparisonMatrixData {
  items: ComparisonItem[];
  dimensions: string[];
  matrix: Record<string, Record<string, string>>;
  recommendation?: string;
}

interface ComparisonMatrixProps {
  data: ComparisonMatrixData;
}

export function ComparisonMatrix({ data }: ComparisonMatrixProps) {
  const { items, dimensions, matrix, recommendation } = data;

  return (
    <div className="space-y-4">
      {/* Comparison Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b-2 border-border">
              <th className="text-left py-2 px-3 font-medium">Item</th>
              {dimensions.map((dimension, idx) => (
                <th key={idx} className="text-left py-2 px-3 font-medium">
                  {dimension}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item, itemIdx) => (
              <tr key={itemIdx} className="border-b border-border/50">
                <td className="py-3 px-3">
                  <div>
                    <div className="font-medium">{item.name}</div>
                    {item.description && (
                      <div className="text-xs text-secondary mt-0.5">
                        {item.description}
                      </div>
                    )}
                  </div>
                </td>
                {dimensions.map((dimension, dimIdx) => {
                  const cellValue = matrix[item.name]?.[dimension] || '-';
                  return (
                    <td key={dimIdx} className="py-3 px-3 text-secondary">
                      {cellValue}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Recommendation */}
      {recommendation && (
        <div className="px-4 py-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <div className="flex items-start gap-2">
            <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 rounded font-medium shrink-0">
              Recommendation
            </span>
            <p className="text-sm text-foreground">{recommendation}</p>
          </div>
        </div>
      )}
    </div>
  );
}
