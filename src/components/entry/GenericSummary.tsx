/**
 * Generic Summary Component
 * 适用于通用结构或降级情况
 */

interface GenericSummaryProps {
  data: {
    summary?: string;
    keyPoints?: string[];
  };
}

export function GenericSummary({ data }: GenericSummaryProps) {
  return (
    <div className="space-y-3">
      {data.summary && (
        <p className="text-sm">{data.summary}</p>
      )}

      {data.keyPoints && data.keyPoints.length > 0 && (
        <ul className="space-y-1">
          {data.keyPoints.map((point, idx) => (
            <li key={idx} className="text-sm flex items-start gap-2">
              <span className="text-primary mt-1">•</span>
              <span>{point}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
