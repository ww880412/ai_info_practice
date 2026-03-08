import { SummaryStructureSchema, validateSummaryStructure } from './schemas';

interface SummaryStructureFallbackContext {
  coreSummary: string;
  keyPoints: string[];
}

function buildGenericSummaryFields(
  coreSummary: string,
  keyPoints: string[]
): Record<string, unknown> {
  return {
    summary: coreSummary,
    keyPoints,
  };
}

export function normalizeSummaryStructureForPersistence(
  value: unknown,
  fallback: SummaryStructureFallbackContext
) {
  const genericFallback = {
    type: 'generic' as const,
    fields: buildGenericSummaryFields(fallback.coreSummary, fallback.keyPoints),
  };

  const parsed = SummaryStructureSchema.safeParse(value);
  if (!parsed.success) {
    return genericFallback;
  }

  const validatedFields = validateSummaryStructure(parsed.data.type, parsed.data.fields);
  if (!validatedFields.success) {
    return genericFallback;
  }

  return {
    type: parsed.data.type,
    ...(parsed.data.reasoning ? { reasoning: parsed.data.reasoning } : {}),
    fields: parsed.data.fields as Record<string, unknown>,
  };
}
