/**
 * Argument-Evidence-Condition Component
 * 适用于观点评论、分析思考类内容
 */

interface ArgumentEvidenceConditionProps {
  data: {
    argument: string;
    evidence: string[];
    conditions?: string[];
  };
}

export function ArgumentEvidenceCondition({ data }: ArgumentEvidenceConditionProps) {
  return (
    <div className="space-y-4">
      {/* Argument */}
      <div>
        <h4 className="text-sm font-medium text-secondary mb-1">Argument</h4>
        <p className="text-sm">{data.argument}</p>
      </div>

      {/* Evidence */}
      {data.evidence && data.evidence.length > 0 && (
        <div>
          <h4 className="text-sm font-medium mb-2">Evidence</h4>
          <ul className="space-y-2">
            {data.evidence.map((item, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-pink-100 dark:bg-pink-900/40 text-pink-700 dark:text-pink-300 text-xs flex items-center justify-center mt-0.5">
                  ✓
                </span>
                <span className="text-sm">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Conditions */}
      {data.conditions && data.conditions.length > 0 && (
        <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <h4 className="text-sm font-medium text-blue-700 dark:text-blue-300 mb-2">Conditions</h4>
          <ul className="space-y-1">
            {data.conditions.map((condition, idx) => (
              <li key={idx} className="text-sm text-blue-600 dark:text-blue-400">
                When: {condition}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
