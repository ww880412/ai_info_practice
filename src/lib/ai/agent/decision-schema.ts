/**
 * Phase 2a: Decision Schema
 * 与 Prisma 枚举和 ingest-contract 完全对齐
 */
import { z } from 'zod';

export const DecisionSchema = z.object({
  // 必填字段 - 与 Prisma 枚举对齐
  contentType: z.enum([
    'TUTORIAL',
    'TOOL_RECOMMENDATION',
    'TECH_PRINCIPLE',
    'CASE_STUDY',
    'OPINION',
  ]),
  techDomain: z.enum([
    'PROMPT_ENGINEERING',
    'AGENT',
    'RAG',
    'FINE_TUNING',
    'DEPLOYMENT',
    'OTHER',
  ]),
  aiTags: z.array(z.string()),
  coreSummary: z.string().min(1),

  // keyPoints - 与 NormalizedKeyPoints 对齐
  keyPoints: z.object({
    core: z.array(z.string()),
    extended: z.array(z.string()).optional(),
  }),

  // summaryStructure - 与 NormalizedSummaryStructure 对齐
  summaryStructure: z.object({
    type: z.enum([
      'problem-solution-steps',
      'concept-mechanism-flow',
      'tool-feature-comparison',
      'background-result-insight',
      'argument-evidence-condition',
      'generic',
      'api-reference',
      'comparison-matrix',
      'timeline-evolution',
    ]),
    reasoning: z.string().optional(),
    fields: z.record(z.string(), z.unknown()),
  }),

  // boundaries - 与 NormalizedBoundaries 对齐
  boundaries: z.object({
    applicable: z.array(z.string()),
    notApplicable: z.array(z.string()).optional(),
  }),

  // 可选评估字段
  confidence: z.number().min(0).max(1).optional(),
  difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']).nullable().optional(),
  sourceTrust: z.enum(['HIGH', 'MEDIUM', 'LOW']).nullable().optional(),
  timeliness: z.enum(['RECENT', 'OUTDATED', 'CLASSIC']).nullable().optional(),
  contentForm: z
    .enum(['TEXTUAL', 'CODE_HEAVY', 'VISUAL', 'MULTIMODAL'])
    .nullable()
    .optional(),

  // practiceValue - 与 Prisma 枚举对齐
  practiceValue: z.enum(['KNOWLEDGE', 'ACTIONABLE']),
  practiceReason: z.string(),

  // practiceTask - 与 NormalizedPracticeTask 对齐
  practiceTask: z
    .object({
      title: z.string(),
      summary: z.string(),
      difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']),
      estimatedTime: z.string(),
      prerequisites: z.array(z.string()),
      steps: z.array(
        z.object({
          order: z.number(),
          title: z.string(),
          description: z.string(),
        })
      ),
    })
    .nullable(),
});

export type AgentDecision = z.infer<typeof DecisionSchema>;
