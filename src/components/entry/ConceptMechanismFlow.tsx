/**
 * Concept-Mechanism-Flow Component
 * 适用于技术原理、概念解释类内容
 */

interface ConceptMechanismFlowProps {
  data: {
    concept: string;
    mechanism: string;
    flow?: string[];
    boundary?: string;
  };
}

export function ConceptMechanismFlow({ data }: ConceptMechanismFlowProps) {
  return (
    <div className="space-y-4">
      {/* Concept */}
      <div>
        <h4 className="text-sm font-medium text-secondary mb-1">Concept</h4>
        <p className="text-sm">{data.concept}</p>
      </div>

      {/* Mechanism */}
      <div>
        <h4 className="text-sm font-medium text-secondary mb-1">Mechanism</h4>
        <p className="text-sm">{data.mechanism}</p>
      </div>

      {/* Flow */}
      {data.flow && data.flow.length > 0 && (
        <div>
          <h4 className="text-sm font-medium mb-2">Flow</h4>
          <div className="flex items-center gap-2 flex-wrap">
            {data.flow.map((item, idx) => (
              <span key={idx} className="text-xs px-2 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded">
                {item}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Boundary */}
      {data.boundary && (
        <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 rounded">
          <h4 className="text-xs font-medium text-red-700 dark:text-red-300 mb-1">Boundary</h4>
          <p className="text-sm text-red-600 dark:text-red-400">{data.boundary}</p>
        </div>
      )}
    </div>
  );
}
