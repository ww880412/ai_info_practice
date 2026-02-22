/**
 * Zod Schemas for Dynamic Summary Structure Validation
 */
import { z } from 'zod';

// Summary structure types
export const SummaryStructureTypeSchema = z.enum([
  'problem-solution-steps',
  'concept-mechanism-flow',
  'tool-feature-comparison',
  'background-result-insight',
  'argument-evidence-condition',
  'generic',
]);

export type SummaryStructureType = z.infer<typeof SummaryStructureTypeSchema>;

// Problem-Solution-Steps schema
const ProblemSolutionStepsSchema = z.object({
  problem: z.string(),
  solution: z.string(),
  steps: z.array(z.object({
    order: z.number(),
    title: z.string(),
    description: z.string().optional(),
  })),
  tips: z.string().optional(),
});

// Concept-Mechanism-Flow schema
const ConceptMechanismFlowSchema = z.object({
  concept: z.string(),
  mechanism: z.string(),
  flow: z.array(z.string()),
  boundary: z.string().optional(),
});

// Tool-Feature-Comparison schema
const ToolFeatureComparisonSchema = z.object({
  tool: z.string(),
  features: z.array(z.string()),
  pros: z.array(z.string()),
  cons: z.array(z.string()),
  scenarios: z.array(z.string()).optional(),
});

// Background-Result-Insight schema
const BackgroundResultInsightSchema = z.object({
  background: z.string(),
  result: z.string(),
  insights: z.array(z.string()),
});

// Argument-Evidence-Condition schema
const ArgumentEvidenceConditionSchema = z.object({
  argument: z.string(),
  evidence: z.array(z.string()),
  conditions: z.array(z.string()).optional(),
});

// Generic schema
const GenericSchema = z.object({
  summary: z.string(),
  keyPoints: z.array(z.string()).optional(),
});

// Map type to schema
const SummaryStructureFieldsSchemaMap: Record<SummaryStructureType, z.ZodType> = {
  'problem-solution-steps': ProblemSolutionStepsSchema,
  'concept-mechanism-flow': ConceptMechanismFlowSchema,
  'tool-feature-comparison': ToolFeatureComparisonSchema,
  'background-result-insight': BackgroundResultInsightSchema,
  'argument-evidence-condition': ArgumentEvidenceConditionSchema,
  'generic': GenericSchema,
};

// Main summary structure schema
export const SummaryStructureSchema = z.object({
  type: SummaryStructureTypeSchema,
  reasoning: z.string().optional(),
  fields: z.unknown(), // Validated separately based on type
});

// KeyPoints schema
export const KeyPointsSchema = z.object({
  core: z.array(z.string()),
  extended: z.array(z.string()).optional(),
});

// Boundaries schema
export const BoundariesSchema = z.object({
  applicable: z.array(z.string()),
  notApplicable: z.array(z.string()).optional(),
});

// Validation function
export function validateSummaryStructure(
  type: SummaryStructureType,
  fields: unknown
): { success: true } | { success: false; error: z.ZodError } {
  const schema = SummaryStructureFieldsSchemaMap[type];
  return schema.safeParse(fields);
}

// Helper to get required fields for a type
export function getRequiredFields(type: SummaryStructureType): string[] {
  switch (type) {
    case 'problem-solution-steps':
      return ['problem', 'solution', 'steps'];
    case 'concept-mechanism-flow':
      return ['concept', 'mechanism', 'flow'];
    case 'tool-feature-comparison':
      return ['tool', 'features', 'pros', 'cons'];
    case 'background-result-insight':
      return ['background', 'result', 'insights'];
    case 'argument-evidence-condition':
      return ['argument', 'evidence'];
    case 'generic':
      return ['summary'];
    default:
      return [];
  }
}
