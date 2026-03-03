# ReAct Agent 升级方案 v2.0 - 关键修订

**修订日期**: 2026-03-01
**修订原因**: 基于 Codex 评审反馈
**修订策略**: 稳健路线（Vercel AI SDK 原生 → 可选 LangGraph）

---

## 修订摘要

### 核心变更

1. **技术选型调整**：从 LangGraph 改为 Vercel AI SDK 原生实现
2. **分阶段实施**：Phase 1 (最小可行) → Phase 2 (可选增强)
3. **契约兼容性**：保持 `NormalizedAgentIngestDecision` 结构
4. **成本模型修正**：从 $45 调整为 $60-75（含重试和修复）
5. **工期调整**：从 14-19h 调整为 Phase 1: 16-24h, Phase 2: 24-40h

---

## 一、技术选型修订

### 原方案问题（Codex Critical #2）

```typescript
// ❌ 原方案：硬编码 ChatOpenAI
const model = new ChatOpenAI({ modelName: 'gpt-4o' });
```

**问题**：
- 破坏现有 `getModel()` 抽象（Gemini/本地代理/凭据体系）
- 需要额外开发 ModelAdapter
- 增加 LangGraph 依赖学习成本

### 修订方案：Vercel AI SDK 原生

```typescript
// ✅ 修订方案：复用现有 provider
import { generateObject } from 'ai';
import { getModel } from '@/lib/ai/client';

const result = await generateObject({
  model: getModel(), // 复用现有 Gemini/本地代理
  tools: {
    check_duplicate: tool({
      description: '检查数据库中是否存在相似内容',
      parameters: z.object({
        content: z.string(),
        threshold: z.number().default(0.7),
      }),
      execute: async ({ content, threshold }) => {
        const similar = await findSimilarEntries(content, threshold);
        return {
          hasDuplicate: similar.length > 0,
          matches: similar.map(s => ({
            id: s.id,
            title: s.title,
            similarity: s.similarity,
          })),
        };
      },
    }),
    find_relations: tool({ /* 新增实现 */ }),
    extract_code: tool({ /* 已有实现 */ }),
  },
  maxSteps: 5, // Vercel AI SDK 原生支持多步推理
  prompt: buildReActPrompt(input),
  schema: z.object({
    // 保持现有契约结构
    contentType: z.enum(['TUTORIAL', 'TOOL_RECOMMENDATION', ...]),
    techDomain: z.enum(['PROMPT_ENGINEERING', 'AGENT', ...]),
    // ... 完整的 NormalizedAgentIngestDecision 结构
  }),
});
```

**优势**：
- ✅ 无新依赖（Vercel AI SDK 已安装）
- ✅ 与现有架构兼容
- ✅ 支持本地代理（成本优化）
- ✅ 工期可控（Phase 1: 2-3 天）

---

## 二、契约兼容性修订

### 原方案问题（Codex Critical #1）

```typescript
// ❌ 原方案：重复内容返回不兼容结构
if (reactResult.observations.hasDuplicate) {
  return {
    shouldIngest: false,
    reason: 'Duplicate content detected',
    duplicateOf: reactResult.observations.duplicateId,
  };
}
```

**问题**：
- `normalizeAgentIngestDecision` 要求完整结构
- 缺少必填字段会导致运行时错误

### 修订方案：契约兼容

```typescript
// ✅ 修订方案：保持完整契约，新增 ingestAction 字段
export interface NormalizedAgentIngestDecision {
  // 新增字段
  ingestAction: 'INGEST' | 'SKIP_DUPLICATE' | 'SKIP_LOW_QUALITY';
  skipReason?: string;
  duplicateOf?: string;
  
  // 保持现有字段（即使 SKIP 也要填充默认值）
  contentType: ContentType;
  techDomain: TechDomain;
  aiTags: string[];
  coreSummary: string;
  // ...
}

// 使用示例
if (hasDuplicate) {
  return {
    ingestAction: 'SKIP_DUPLICATE',
    skipReason: 'Found similar content',
    duplicateOf: matchId,
    // 填充默认值保持契约完整
    contentType: 'TECH_PRINCIPLE',
    techDomain: 'OTHER',
    aiTags: [],
    coreSummary: '(skipped due to duplication)',
    // ...
  };
}
```

---

## 三、工具实现补齐

### 原方案问题（Codex High #4）

- `find_relations` 在文档中使用但未实现
- `config.ts` 中有未注册的工具名

### 修订方案：工具台账

| 工具名 | 状态 | 优先级 | 实现位置 |
|--------|------|--------|----------|
| `check_duplicate` | ✅ 已实现 | P0 | `builtin-tools.ts:288` |
| `extract_code` | ✅ 已实现 | P0 | `builtin-tools.ts:216` |
| `extract_version` | ✅ 已实现 | P1 | `builtin-tools.ts:249` |
| `find_relations` | ❌ 待实现 | P0 | **Phase 1 新增** |
| `classify_content` | ✅ 已实现 | P0 | `builtin-tools.ts:75` |
| `extract_summary` | ✅ 已实现 | P0 | `builtin-tools.ts:147` |
| `evaluate_dimension` | ⚠️ 未使用 | P2 | `builtin-tools.ts:25` |
| `route_to_strategy` | ⚠️ 未使用 | P2 | `route-strategy.ts:37` |

**Phase 1 必须实现**：
```typescript
// src/lib/ai/agent/builtin-tools-v2.ts
export const findRelationsTool = tool({
  description: '发现内容与现有知识库的关联关系',
  parameters: z.object({
    content: z.string(),
    title: z.string(),
    maxResults: z.number().default(5),
  }),
  execute: async ({ content, title, maxResults }) => {
    const relations = await discoverAssociations({
      title,
      summary: content.slice(0, 500),
      tags: [], // 从 content 提取
    }, maxResults);
    
    return {
      relatedEntries: relations.map(r => ({
        id: r.id,
        title: r.title,
        relationshipType: r.relationType,
        confidence: r.similarity,
      })),
    };
  },
});
```

---

## 四、成本模型修正

### 原方案问题（Codex High #3）

```
原估算：$30 → $45 (+50%)
遗漏项：
- decision-repair 二次调用
- 重试机制（最多 3 次）
- 工具调用额外 token
```

### 修订方案：公式化估算

```typescript
// 成本计算公式
const costPerEntry = (
  inputTokens * inputPrice +
  outputTokens * outputPrice
) * (1 + retryRate) * (1 + repairRate) * stepCount;

// 参数假设（基于 Gemini 2.0 Flash）
const params = {
  inputPrice: 0.075 / 1M,  // $0.075 per 1M tokens
  outputPrice: 0.30 / 1M,  // $0.30 per 1M tokens
  avgInputTokens: 8000,    // 平均输入（含工具结果）
  avgOutputTokens: 2000,   // 平均输出
  retryRate: 0.15,         // 15% 请求需要重试
  repairRate: 0.20,        // 20% 需要 decision-repair
  stepCount: 3.5,          // 平均步数（1-5 步）
};

// P50 成本
const p50Cost = (
  8000 * 0.075/1e6 + 2000 * 0.30/1e6
) * 1.15 * 1.20 * 3.5
= $0.0036 per entry

// P95 成本（长文本 + 多次重试）
const p95Cost = (
  20000 * 0.075/1e6 + 5000 * 0.30/1e6
) * 1.30 * 1.40 * 5
= $0.0195 per entry

// 月成本（100 条/天）
月成本 = 100 * 30 * $0.0036 = $10.8 (P50)
月成本 = 100 * 30 * $0.0195 = $58.5 (P95)
```

**结论**：
- 使用 Gemini 2.0 Flash：$11-59/月（P50-P95）
- 使用本地代理：接近 $0（仅算力成本）
- 原估算 $45 在合理范围内，但需要监控 P95

---

## 五、实施计划修订

### Phase 1: 最小可行 ReAct（16-24h, 2-3 天）

| 任务 | 工作量 | 依赖 | 验收标准 |
|------|--------|------|----------|
| **1.1 工具补齐** | 4-6h | - | `find_relations` 实现并测试通过 |
| **1.2 Vercel AI SDK 集成** | 6-8h | 1.1 | `maxSteps` + `tools` 工作正常 |
| **1.3 契约兼容** | 2-3h | 1.2 | `ingestAction` 字段生效 |
| **1.4 双入口改造** | 2-3h | 1.3 | Inngest + API Route 统一接入 |
| **1.5 测试验证** | 2-4h | 1.4 | 10 条测试数据通过 |

**Phase 1 交付物**：
- ✅ 工具真正被调用（check_duplicate、find_relations、extract_code）
- ✅ 动态输出深度（根据内容长度调整 keyPoints 数量）
- ✅ 契约兼容（保持 `NormalizedAgentIngestDecision`）
- ✅ 成本可控（使用本地代理）

### Phase 2: 可选增强（24-40h, 3-5 天，1-2 周后评估）

**决策依据**：
- Phase 1 效果是否满足需求？
- 是否需要更复杂的状态管理？
- 是否需要多 Agent 协作？

**如果需要**：
- LangGraph 集成（需要 ModelAdapter）
- 长期记忆（LangMem）
- 多 Agent 协作

---

## 六、验证标准修订

### 原方案问题（Codex Medium #9）

- 主要依赖人工抽查
- 缺少可重复基线

### 修订方案：自动化验证

#### 6.1 黄金数据集

```typescript
// tests/fixtures/golden-dataset.ts
export const GOLDEN_DATASET = [
  {
    id: 'short-tutorial',
    input: { content: '...', length: 2500 },
    expected: {
      keyPoints: { core: 3, extended: 1 },
      toolsCalled: ['check_duplicate'],
      summaryLength: [100, 150],
    },
  },
  {
    id: 'long-research',
    input: { content: '...', length: 15000 },
    expected: {
      keyPoints: { core: 8, extended: 4 },
      toolsCalled: ['check_duplicate', 'find_relations'],
      summaryLength: [400, 600],
    },
  },
  // ... 10 条覆盖不同场景
];
```

#### 6.2 自动回归测试

```typescript
// tests/agent/regression.test.ts
describe('ReAct Agent Regression', () => {
  GOLDEN_DATASET.forEach(({ id, input, expected }) => {
    it(`should handle ${id} correctly`, async () => {
      const result = await agent.process(input);
      
      // 验证工具调用
      expect(result.toolsCalled).toEqual(
        expect.arrayContaining(expected.toolsCalled)
      );
      
      // 验证输出深度
      expect(result.keyPoints.core.length).toBe(expected.keyPoints.core);
      
      // 验证摘要长度
      const summaryLength = result.coreSummary.length;
      expect(summaryLength).toBeGreaterThanOrEqual(expected.summaryLength[0]);
      expect(summaryLength).toBeLessThanOrEqual(expected.summaryLength[1]);
    });
  });
});
```

#### 6.3 A/B 指标门槛

| 指标 | Baseline (现状) | Target (Phase 1) | 测量方法 |
|------|----------------|------------------|----------|
| 工具调用率 | 0% | >80% | 日志统计 |
| 摘要长度适配 | 固定 | 动态 (±30%) | 自动测试 |
| 处理时间 | 15s (P50) | <30s (P50) | Inngest metrics |
| 成本 | $0.30/entry | <$0.60/entry | Token 统计 |
| 质量分 | 6.5/10 | >7.5/10 | `evaluateDecisionQuality` |

---

## 七、安全约束（新增章节）

### 7.1 工具白名单

```typescript
// src/lib/ai/agent/security.ts
const ALLOWED_TOOLS = [
  'check_duplicate',
  'find_relations',
  'extract_code',
  'extract_version',
] as const;

export function validateToolCall(toolName: string): boolean {
  return ALLOWED_TOOLS.includes(toolName as any);
}
```

### 7.2 参数上限

```typescript
const TOOL_LIMITS = {
  check_duplicate: {
    maxContentLength: 50000,
    maxResults: 10,
  },
  find_relations: {
    maxResults: 10,
    maxCandidates: 100, // 数据库查询上限
  },
};
```

### 7.3 敏感字段脱敏

```typescript
// 工具调用前脱敏
function sanitizeForTool(content: string): string {
  return content
    .replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[SSN]')
    .replace(/\b[\w.-]+@[\w.-]+\.\w+\b/g, '[EMAIL]');
}
```

### 7.4 审计日志

```typescript
// 每次工具调用记录
await prisma.toolCallLog.create({
  data: {
    entryId,
    toolName,
    parameters: sanitize(params),
    result: sanitize(result),
    timestamp: new Date(),
  },
});
```

---

## 八、ADR: 为什么不是 LangGraph 优先？

### 背景

原方案建议直接引入 LangGraph 实现 ReAct 循环。

### 决策

**Phase 1 使用 Vercel AI SDK 原生实现，Phase 2 可选 LangGraph。**

### 理由

#### 支持 Vercel AI SDK 的理由

1. **已有依赖**：项目已安装 `ai` 包，无需新增依赖
2. **架构兼容**：与现有 `getModel()` 无缝集成
3. **功能充足**：`maxSteps` + `tools` 已支持多步推理
4. **学习成本低**：团队已熟悉 Vercel AI SDK
5. **工期可控**：2-3 天即可验证效果

#### LangGraph 的劣势

1. **新增依赖**：需要 `@langchain/langgraph` + `@langchain/openai`
2. **架构冲突**：需要开发 ModelAdapter 适配现有 provider
3. **学习成本**：团队需要学习 LangGraph 概念（StateGraph、checkpointer）
4. **工期风险**：5-8 天，且可能遇到集成问题

#### 何时考虑 LangGraph？

如果 Phase 1 后发现以下需求：
- 需要复杂的状态管理（多轮对话、断点续传）
- 需要多 Agent 协作（分类 Agent + 提取 Agent）
- 需要可视化调试（LangGraph Studio）

则在 Phase 2 引入 LangGraph。

### 后果

- ✅ 降低初期风险
- ✅ 快速验证效果
- ⚠️ 如果后续需要 LangGraph，需要二次重构

---

## 九、修订后的决策点

### ✅ 已确认的决策

1. **技术路线**：Vercel AI SDK 原生（Phase 1）→ 可选 LangGraph（Phase 2）
2. **工具优先级**：补齐所有工具（包括 `find_relations`）
3. **成本预算**：使用本地代理，短期超预算可接受
4. **实施时间**：下周开始 Phase 1

### 🔄 待确认的细节

1. **本地代理配置**：
   - [ ] 确认本地代理 endpoint 和 API key
   - [ ] 确认模型选择（gpt-4o-mini / qwen-plus / deepseek-v3）

2. **黄金数据集**：
   - [ ] 从现有 Entry 中选择 10 条代表性数据
   - [ ] 人工标注预期输出

3. **灰度策略**：
   - [ ] 先在 API Route 测试（手动触发）
   - [ ] 再切换 Inngest（自动处理）
   - [ ] 最后全量切换

---

## 十、下一步行动

1. **本周**：
   - [ ] 用户确认修订方案
   - [ ] Codex 二次评审
   - [ ] 准备黄金数据集

2. **下周 Phase 1**：
   - [ ] Day 1: 工具补齐 + 测试
   - [ ] Day 2: Vercel AI SDK 集成
   - [ ] Day 3: 验证 + 修复

3. **1-2 周后**：
   - [ ] 评估 Phase 1 效果
   - [ ] 决定是否进入 Phase 2
