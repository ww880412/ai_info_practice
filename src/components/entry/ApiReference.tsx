/**
 * API Reference Component
 * Renders API documentation with parameters, return values, examples, and error codes
 */

interface Parameter {
  name: string;
  type: string;
  required: boolean;
  description: string;
}

interface CodeExample {
  title: string;
  code: string;
  language?: string;
}

interface ErrorCode {
  code: string;
  description: string;
}

interface ApiReferenceData {
  endpoint?: string;
  parameters?: Parameter[];
  returnValue?: string;
  examples?: CodeExample[];
  errorCodes?: ErrorCode[];
}

interface ApiReferenceProps {
  data: ApiReferenceData;
}

export function ApiReference({ data }: ApiReferenceProps) {
  const { endpoint, parameters, returnValue, examples, errorCodes } = data;

  return (
    <div className="space-y-4">
      {/* Endpoint */}
      {endpoint && (
        <div>
          <h4 className="text-sm font-medium mb-2">Endpoint</h4>
          <code className="block px-3 py-2 bg-accent rounded text-sm font-mono">
            {endpoint}
          </code>
        </div>
      )}

      {/* Parameters */}
      {parameters && parameters.length > 0 && (
        <div>
          <h4 className="text-sm font-medium mb-2">Parameters</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-3 font-medium">Name</th>
                  <th className="text-left py-2 px-3 font-medium">Type</th>
                  <th className="text-left py-2 px-3 font-medium">Required</th>
                  <th className="text-left py-2 px-3 font-medium">Description</th>
                </tr>
              </thead>
              <tbody>
                {parameters.map((param, idx) => (
                  <tr key={idx} className="border-b border-border/50">
                    <td className="py-2 px-3 font-mono text-xs">{param.name}</td>
                    <td className="py-2 px-3 font-mono text-xs text-secondary">{param.type}</td>
                    <td className="py-2 px-3">
                      {param.required ? (
                        <span className="text-xs px-1.5 py-0.5 bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 rounded">
                          Required
                        </span>
                      ) : (
                        <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 rounded">
                          Optional
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-secondary">{param.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Return Value */}
      {returnValue && (
        <div>
          <h4 className="text-sm font-medium mb-2">Return Value</h4>
          <p className="text-sm text-secondary px-3 py-2 bg-accent rounded">
            {returnValue}
          </p>
        </div>
      )}

      {/* Code Examples */}
      {examples && examples.length > 0 && (
        <div>
          <h4 className="text-sm font-medium mb-2">Examples</h4>
          <div className="space-y-3">
            {examples.map((example, idx) => (
              <div key={idx}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium">{example.title}</span>
                  {example.language && (
                    <span className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 rounded">
                      {example.language}
                    </span>
                  )}
                </div>
                <pre className="px-3 py-2 bg-accent rounded text-xs font-mono overflow-x-auto">
                  <code>{example.code}</code>
                </pre>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error Codes */}
      {errorCodes && errorCodes.length > 0 && (
        <div>
          <h4 className="text-sm font-medium mb-2">Error Codes</h4>
          <div className="space-y-2">
            {errorCodes.map((error, idx) => (
              <div key={idx} className="flex items-start gap-2 px-3 py-2 bg-red-50 dark:bg-red-900/10 rounded">
                <code className="text-xs font-mono font-medium text-red-700 dark:text-red-400 shrink-0">
                  {error.code}
                </code>
                <span className="text-sm text-secondary">{error.description}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
