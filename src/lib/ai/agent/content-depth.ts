/**
 * Content Depth - 根据内容长度决定 summaryStructure.fields 填充深度
 * Phase 2b-1: 两步模式动态输出
 */

import { getRequiredFields, type SummaryStructureType } from './schemas';

export type ContentDepth = 'SHORT' | 'MEDIUM' | 'LONG';

// 阈值可配置（ENV 或后续数据驱动）
const SHORT_THRESHOLD = parseInt(process.env.CONTENT_DEPTH_SHORT ?? '2000', 10);
const LONG_THRESHOLD = parseInt(process.env.CONTENT_DEPTH_LONG ?? '10000', 10);

/**
 * 根据内容长度返回深度分级
 */
export function getContentDepth(contentLength: number): ContentDepth {
  if (contentLength < SHORT_THRESHOLD) return 'SHORT';
  if (contentLength <= LONG_THRESHOLD) return 'MEDIUM';
  return 'LONG';
}

/**
 * 各类型的推荐字段（用于 requiredFields.length < 2 时补齐）
 * 包含完整字段列表用于 LONG 深度
 */
const RECOMMENDED_FIELDS: Record<string, string[]> = {
  'api-reference': ['endpoint', 'returnValue', 'parameters', 'examples', 'errorCodes'],
  'generic': ['summary', 'keyPoints'],
  'timeline-evolution': ['events', 'currentStatus', 'futureOutlook'],
  'problem-solution-steps': ['problem', 'solution', 'steps', 'tips'],
  'concept-mechanism-flow': ['concept', 'mechanism', 'flow', 'boundary'],
  'tool-feature-comparison': ['tool', 'features', 'pros', 'cons', 'scenarios'],
  'background-result-insight': ['background', 'result', 'insights'],
  'argument-evidence-condition': ['argument', 'evidence', 'conditions'],
  'comparison-matrix': ['items', 'dimensions', 'matrix', 'recommendation'],
};

/**
 * 根据深度和结构类型生成 fields 填充指南
 * 规则：当 requiredFields.length < 2 时，至少输出 2 个推荐字段
 */
export function getFieldsGuidance(
  depth: ContentDepth,
  structureType: string | undefined
): string {
  // 兜底：无效或未知类型时返回空字符串
  if (!structureType || !RECOMMENDED_FIELDS[structureType]) {
    return '';
  }

  const requiredFields = getRequiredFields(structureType as SummaryStructureType);
  const recommendedFields = RECOMMENDED_FIELDS[structureType] ?? [];

  // 确定最小字段数
  const minFieldCount = Math.max(2, requiredFields.length);

  // 根据深度选择填充字段
  let targetFields: string[];
  if (depth === 'SHORT') {
    // SHORT: 至少 2 个字段
    if (requiredFields.length >= 2) {
      targetFields = requiredFields;
    } else {
      // 补齐到 2 个
      targetFields = recommendedFields.slice(0, minFieldCount);
    }
  } else if (depth === 'MEDIUM') {
    // MEDIUM: 必填 + 常用可选
    targetFields = recommendedFields.slice(0, Math.max(minFieldCount, 4));
  } else {
    // LONG: 完整字段
    targetFields = recommendedFields;
  }

  const depthHint = {
    SHORT: '简洁版：填充核心字段',
    MEDIUM: '标准版：填充必填 + 常用可选字段',
    LONG: '详细版：填充所有字段',
  }[depth];

  return `
summaryStructure.fields 填充要求（${depth} 内容）：
- ${depthHint}
- 必须填充字段：${targetFields.join(', ')}
- 最少字段数：${minFieldCount}
- 字段值使用简体中文，保留必要英文术语
`;
}
