# 动态总结结构推理 - 实施计划

> **版本**: v1.4
> **日期**: 2026-02-22
> **状态**: Draft
> **更新**: 合并最终修正：SQL语法、evaluation降级、空分块保护、回滚边界、执行门槛

---

## 1. 目标

实现真正的动态总结输出，解决当前"输出缺少灵活性"的问题：

1. **两步式推理**：先分析内容特征 → 再按最优结构提取
2. **动态结构**：根据内容类型推理最佳总结格式
3. **分层要点**：区分"必须掌握"vs"扩展了解"
4. **前端适配**：根据结构类型动态渲染展示

---

## 2. 架构设计

### 2.1 两步式 Workflow

```
┌─────────────────────────────────────────────────────────────┐
│                    Agent Workflow                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Step 1: 内容分析                                            │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ - 分析文档长度/质量/形式                               │  │
│  │ - 判断内容类型 (教程/工具/原理/案例/观点)              │  │
│  │ - 推理最佳总结结构                                    │  │
│  └─────────────────────────────────────────────────────┘  │
│                           ↓                                  │
│  Step 2: 知识提取                                            │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ - 按推理的结构提取内容                                │  │
│  │ - 提取分层要点 (core/extended)                       │  │
│  │ - 提取适用边界                                        │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 总结结构类型

| 类型 | 说明 | 字段 |
|------|------|------|
| `problem-solution-steps` | 问题→方案→步骤 | problem, solution, steps[], tips |
| `concept-mechanism-flow` | 概念→机制→流程 | concept, mechanism, flow[], boundary |
| `tool-feature-comparison` | 工具→功能→对比 | tool, features[], pros[], cons[], scenarios[] |
| `background-result-insight` | 背景→结果→启发 | background, result, insights[] |
| `argument-evidence-condition` | 观点→论据→条件 | argument, evidence[], conditions[] |
| `generic` | 通用结构 | summary, keyPoints[] |

### 2.3 新的 Agent Prompt 设计

**Step 1 Prompt（分析 + 推理结构）**：

```
你是一个知识结构规划专家。分析以下内容，推理出最适合的总结结构。

内容：[输入内容前2000字]

请返回：
{
  "contentType": "TUTORIAL" | "TOOL_RECOMMENDATION" | "TECH_PRINCIPLE" | "CASE_STUDY" | "OPINION",
  "summaryStructure": {
    "type": "problem-solution-steps" | "concept-mechanism-flow" | "tool-feature-comparison" | "background-result-insight" | "argument-evidence-condition" | "generic",
    "reasoning": "为什么选择这个结构"
  },
  "keyPoints": {
    "core": ["必须掌握的点1", "必须掌握的点2"],
    "extended": ["扩展了解的点1"]
  },
  "boundaries": {
    "applicable": ["场景1", "场景2"],
    "notApplicable": ["场景1"]
  },
  "confidence": 0.85
}
```

**Step 2 Prompt（按结构提取）**：

```
基于以下结构规划，提取知识：

结构类型：{type}
结构字段：{requiredFields}

内容：[完整内容]

请按结构提取，返回严格JSON。
```

---

## 3. 数据模型变更

### 3.1 Entry 表扩展

```prisma
model Entry {
  // ... existing fields

  // 动态总结（核心改动）
  summaryStructure Json    // { type, fields, reasoning }
  keyPoints        Json    // { core: [], extended: [] }
  boundaries       Json    // { applicable: [], notApplicable: [] }

  // 扩展字段
  confidence       Float?  // 综合置信度
}
```

### 3.2 Summary Structure JSON 结构

```typescript
interface SummaryStructure {
  type: 'problem-solution-steps' | 'concept-mechanism-flow' | ...;
  reasoning: string;           // 为什么选择这个结构
  fields: Record<string, any>; // 动态字段
}

interface KeyPoints {
  core: string[];      // 必须掌握
  extended: string[]; // 扩展了解
}

interface Boundaries {
  applicable: string[];     // 适用场景
  notApplicable: string[]; // 不适用场景
}
```

---

## 4. 前端展示设计

### 4.1 Entry 详情页结构

```
┌─────────────────────────────────────────────────┐
│  标题 + 来源 + 置信度                            │
├─────────────────────────────────────────────────┤
│  【类型标签】           适用边界                 │
├─────────────────────────────────────────────────┤
│  核心摘要 (coreSummary)                         │
├─────────────────────────────────────────────────┤
│  ┌───────────────────────────────────────────┐ │
│  │  动态 Summary 组件                        │ │
│  │  (根据 summaryStructure.type 渲染)       │ │
│  └───────────────────────────────────────────┘ │
├─────────────────────────────────────────────────┤
│  💡 关键要点                                    │
│  [核心] 必须掌握1                               │
│  [核心] 必须掌握2                               │
│  [扩展] 扩展了解1                               │
├─────────────────────────────────────────────────┤
│  🎯 适用场景          ⚠️ 不适用场景             │
├─────────────────────────────────────────────────┤
│  [如需实践] → 跳转 Practice                    │
└─────────────────────────────────────────────────┘
```

### 4.2 组件映射

| 结构类型 | 组件 |
|----------|------|
| `problem-solution-steps` | `<ProblemSolutionSteps />` |
| `concept-mechanism-flow` | `<ConceptMechanismFlow />` |
| `tool-feature-comparison` | `<ToolFeatureComparison />` |
| `background-result-insight` | `<BackgroundResultInsight />` |
| `argument-evidence-condition` | `<ArgumentEvidenceCondition />` |
| `generic` | `<GenericSummary />` |

### 4.3 关键 UI 元素

- **核心/扩展标记**：使用不同颜色区分（核心=强调色，扩展=普通色）
- **适用/不适用**：绿色/红色标签
- **结构推理理由**：hover 显示"为什么选这个结构"

---

## 5. 实施步骤

### Phase 1: 数据层 + 兼容设计

| 序号 | 任务 | 文件 |
|------|------|------|
| 1.1 | Prisma schema 添加新字段（向后兼容） | `schema.prisma` |
| 1.2 | 生成 migration（添加 JSON 字段） | - |
| 1.3 | 存量数据回填脚本 | `scripts/migrate-keypoints.ts` |
| 1.4 | 配置 Feature Flag: `DYNAMIC_SUMMARY_ENABLED` | `config/` |
| 1.5 | Zod schema 定义各 type 的 fields 校验 | `lib/ai/agent/schemas.ts` |

#### 1.2.1 数据库迁移详细步骤

```sql
-- Step 1: 添加新 JSON 字段（ nullable，先不上线）
ALTER TABLE "Entry" ADD COLUMN IF NOT EXISTS "summaryStructure" JSONB;
ALTER TABLE "Entry" ADD COLUMN IF NOT EXISTS "keyPointsNew" JSONB;
ALTER TABLE "Entry" ADD COLUMN IF NOT EXISTS "boundaries" JSONB;
ALTER TABLE "Entry" ADD COLUMN IF NOT EXISTS "confidence" DOUBLE PRECISION;

-- Step 2: 双写期间（Feature Flag = OFF）
-- 新数据同时写入 keyPoints (string[]) 和 keyPointsNew (JSON)
-- 只读取 keyPoints，忽略 keyPointsNew

-- Step 3: 迁移存量数据（适配 keyPoints: text[]）
UPDATE "Entry"
SET "keyPointsNew" = jsonb_build_object(
  'core', COALESCE(to_jsonb("keyPoints"), '[]'::jsonb),
  'extended', '[]'::jsonb
)
WHERE "keyPointsNew" IS NULL;

-- Step 4: 验证迁移结果
SELECT count(*) as total,
       count("keyPointsNew") as migrated,
       count(*) - count("keyPointsNew") as pending
FROM "Entry" WHERE "keyPoints" IS NOT NULL;

-- Step 5: 切换读取（Feature Flag = ON）
-- 读取 keyPointsNew，keyPoints 作为兼容

-- Step 6: 稳定后删除旧字段
ALTER TABLE "Entry" DROP COLUMN IF EXISTS "keyPoints";
ALTER TABLE "Entry" RENAME COLUMN "keyPointsNew" TO "keyPoints";

-- 回滚方案
-- ALTER TABLE "Entry" DROP COLUMN IF EXISTS "keyPointsNew";
-- -- 重新执行 Step 1
```

**回滚边界说明**：
- **Step 6 前**：可通过删除 `keyPointsNew` 并恢复双写逻辑回滚。
- **Step 6 后**：旧列已删除，不支持自动回滚；必须从发布前数据库备份恢复。
- **发布要求**：执行 Step 6 前必须完成一次全量备份，并验证恢复演练。

#### 1.2.2 锁影响评估

| 阶段 | 锁类型 | 影响 |
|------|--------|------|
| ADD COLUMN | ShareRowExclusiveLock | 短时表锁，取决于表大小 |
| UPDATE | RowExclusiveLock | 行级锁，建议分批执行 |
| DROP COLUMN | AccessExclusiveLock | 大表可能较慢，建议在低峰期 |

**分批迁移建议**：
```sql
-- 每批 1000 条
UPDATE "Entry" SET "keyPointsNew" = jsonb_build_object(
  'core', "keyPoints",
  'extended', '[]'::jsonb
) WHERE "keyPoints" IS NOT NULL
  AND "keyPointsNew" IS NULL
  AND id IN (SELECT id FROM "Entry" WHERE "keyPoints" IS NOT NULL LIMIT 1000);
```

### Phase 2: Agent 改造

| 序号 | 任务 | 文件 |
|------|------|------|
| 2.1 | 修改 `buildSystemPrompt` 支持两步式 | `engine.ts` |
| 2.2 | 实现 token budget + chunking | `engine.ts` |
| 2.3 | 置信度计算公式实现 | `lib/ai/agent/confidence.ts` |
| 2.4 | 新增结构类型常量 | `types.ts` |
| 2.5 | 更新 `ingest-contract.ts` 适配新字段 | - |

### Phase 3: 前端展示

| 序号 | 任务 | 文件 |
|------|------|------|
| 3.1 | 创建 `DynamicSummary` 组件 | `components/entry/` |
| 3.2 | 创建各类型展示组件 | - |
| 3.3 | 前端兼容处理新旧 keyPoints 格式 | `components/entry/` |
| 3.4 | 改造 Entry 详情页使用新组件 | `entry/[id]/page.tsx` |
| 3.5 | 改造 EntryCard 展示分层要点 | - |

### Phase 4: 测试验证 + 上线

| 序号 | 任务 | 指标 |
|------|------|------|
| 4.1 | 单元测试：不同内容类型产出正确结构 | 结构类型准确率 > 80% |
| 4.2 | 分层测试：core/extended 区分准确率 | > 75% |
| 4.3 | E2E：完整入库流程 | 通过 |
| 4.4 | 人工评审rubric | 满意度 > 70% |
| 4.5 | Canary 放量 (10% → 50% → 100%) | 监控错误率 < 1% |

---

## 6. 关键技术设计

### 6.1 置信度计算公式

```typescript
// 置信度 = 加权来源 + 加权完整度 + 评估可信度（降低乘法敏感性）
interface ConfidenceScore {
  source: number;      // 来源可信度: 0.3-1.0 (LOW=0.3, MEDIUM=0.6, HIGH=1.0)
  completeness: number; // 内容完整度: 0.3-1.0 (FRAGMENT=0.3, INCREMENTAL=0.6, COMPLETE=1.0)
  evaluation: number;  // 评估可信度: 0.5-1.0 (见 6.1.1)
}

// 使用加权平均，降低单维度失败的影响
function calculateConfidence(scores: ConfidenceScore): number {
  return scores.source * 0.3 + scores.completeness * 0.4 + scores.evaluation * 0.3;
}

// 降级阈值（调整为 0.5，允许更多样本使用动态结构）
const CONFIDENCE_THRESHOLD = 0.5;  // < 0.5 使用 generic 结构
```

### 6.1.1 Evaluation 可复现算法

```typescript
// 基于 JSON 解析成功率 + 字段完整度计算
function calculateEvaluation(response: string, requiredFields: string[]): number {
  if (!requiredFields || requiredFields.length === 0) return 0.3;

  let parsed: Record<string, unknown> | null = null;
  try {
    parsed = JSON.parse(response);
  } catch {
    // 解析失败直接低分，触发 generic 降级
    return 0.3;
  }

  const fieldScore =
    requiredFields.filter((f) => parsed?.[f] !== undefined).length / requiredFields.length;

  const nonEmptyScore =
    requiredFields.reduce((acc, f) => {
      const val = parsed?.[f];
      if (val === undefined || val === null) return acc;
      if (typeof val === "string" && val.trim().length > 0) return acc + 1;
      if (Array.isArray(val) && val.length > 0) return acc + 1;
      if (typeof val === "object" && Object.keys(val as Record<string, unknown>).length > 0) return acc + 1;
      return acc;
    }, 0) / requiredFields.length;

  return 1.0 * 0.3 + fieldScore * 0.4 + nonEmptyScore * 0.3;
}
```

### 6.2 Token Budget + Chunking

```typescript
// Step 2 输入控制（优化中文估算）
const MAX_INPUT_CHARS = 40000;  // 保守估算，中文约 1.5 token/char

function truncateForStep2(content: string): string {
  if (content.length <= MAX_INPUT_CHARS) return content;
  return content.slice(0, MAX_INPUT_CHARS) + '\n...(内容已截断)';
}

// 分块处理长内容（带限流）
async function processLongContent(content: string, structure: SummaryStructure) {
  const chunks = chunkByParagraph(content, MAX_CHUNK_CHARS);

  // 空分块保护
  if (!chunks.length) {
    return mergeResults([]);
  }

  const results: Result[] = [];
  const errors: Error[] = [];

  // 限流：每次最多 3 个并发
  const concurrencyLimit = 3;
  const MIN_SUCCESS_RATE = 0.7; // 最小成功率门槛

  for (let i = 0; i < chunks.length; i += concurrencyLimit) {
    const batch = chunks.slice(i, i + concurrencyLimit);
    const batchResults = await Promise.allSettled(
      batch.map(c => withRetry(() => extractByStructure(c, structure), 3))
    );

    // 记录成功/失败
    batchResults.forEach((r, idx) => {
      if (r.status === 'fulfilled' && r.value !== null) {
        results.push(r.value);
      } else {
        const reason = r.status === 'rejected' ? r.reason : 'null result';
        errors.push(new Error(`Chunk ${i + idx}: ${reason}`));
      }
    });

    // 批次间隔，避免触发速率限制
    if (i + concurrencyLimit < chunks.length) {
      await sleep(1000);
    }
  }

  // 检查成功率门槛
  const successRate = results.length / chunks.length;
  if (successRate < MIN_SUCCESS_RATE) {
    throw new Error(`分块成功率 ${successRate.toFixed(2)} 低于门槛 ${MIN_SUCCESS_RATE}，共 ${errors.length} 个错误`);
  }

  // 合并成功结果
  return mergeResults(results);
}

// 重试策略
async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await sleep(Math.pow(2, i) * 1000); // 指数退避
    }
  }
  throw new Error('Max retries exceeded');
}
```

### 6.3 存量数据迁移（双写/双读 + 切换点）

```typescript
// Prisma schema 设计（Json 类型，兼容两种格式）
// keyPoints Json  // 可能是 string[] 或 { core: [], extended: [] }

// ========== 写入侧（双写）==========
function normalizeKeyPointsForWrite(rawKeyPoints: unknown): { core: string[], extended: string[] } {
  // 新格式：直接返回
  if (rawKeyPoints && typeof rawKeyPoints === 'object') {
    const kp = rawKeyPoints as { core?: string[], extended?: string[] };
    if (kp.core !== undefined && kp.extended !== undefined) {
      return { core: kp.core, extended: kp.extended };
    }
  }

  // 旧格式：自动转换
  if (Array.isArray(rawKeyPoints)) {
    return {
      // 旧数据全部归为 core，保持与读取侧一致
      core: rawKeyPoints,
      extended: [],
    };
  }

  // 空数据兜底
  return { core: [], extended: [] };
}

// ========== 读取侧（双读 + 前端兼容）==========
function normalizeKeyPointsForRead(rawKeyPoints: unknown): { core: string[], extended: string[], flat: string[] } {
  if (Array.isArray(rawKeyPoints)) {
    // 旧数据：全部归为 core，extended 为空
    return { core: rawKeyPoints, extended: [], flat: rawKeyPoints };
  }

  if (rawKeyPoints && typeof rawKeyPoints === 'object') {
    const kp = rawKeyPoints as { core?: string[], extended?: string[] };
    return {
      core: kp.core || [],
      extended: kp.extended || [],
      flat: [...(kp.core || []), ...(kp.extended || [])],
    };
  }

  return { core: [], extended: [], flat: [] };
}

// ========== 切换点（渐进发布）==========
// Phase 1: Feature Flag OFF → 所有新数据走双写，旧数据不迁移
// Phase 2: Feature Flag ON + 迁移脚本运行 → 存量数据迁移
// Phase 3: 验证稳定后 → 移除旧数据格式兼容代码
```

### 6.4 Feature Flag

```typescript
// config/flags.ts
export const FEATURE_FLAGS = {
  DYNAMIC_SUMMARY_ENABLED: process.env.DYNAMIC_SUMMARY_ENABLED === 'true',
};

// 降级逻辑
if (!FEATURE_FLAGS.DYNAMIC_SUMMARY_ENABLED) {
  return fallbackToLegacySchema(result);
}
```

### 6.5 Zod Schema 校验

```typescript
// lib/ai/agent/schemas.ts
import { z } from 'zod';

export const SummaryStructureSchemas = {
  'problem-solution-steps': z.object({
    problem: z.string(),
    solution: z.string(),
    steps: z.array(z.object({
      order: z.number(),
      title: z.string(),
      description: z.string().optional(),
    })),
    tips: z.string().optional(),
  }),
  'concept-mechanism-flow': z.object({
    concept: z.string(),
    mechanism: z.string(),
    flow: z.array(z.string()),
    boundary: z.string().optional(),
  }),
  // ... 其他 type
};

export function validateStructure(type: string, fields: unknown) {
  const schema = SummaryStructureSchemas[type];
  return schema?.safeParse(fields);
}
```

---

## 7. 回退策略

如果 Agent 输出不稳定：

1. **降级方案**：Feature Flag 关闭时返回固定 schema（同当前）
2. **阈值控制**：
   - confidence < 0.5 时使用 `generic` 结构
   - `successRate < 0.7` 时抛出异常
   - `evaluation < 0.3` 时触发 generic 降级
3. **人工兜底**：可标记需要人工复核
4. **Canary 策略**：
   - `DYNAMIC_SUMMARY_ENABLED` 在 Canary 阶段仅对新写入生效
   - 仅当"结构准确率、分层准确率、错误率"连续两天达标后再执行 Step 6

---

## 8. 成本评估

| 项目 | 估算 |
|------|------|
| API 调用 | 2次/文档（当前1次） |
| 开发周期 | 2-3 天 |
| 前端工作量 | 1-2 天 |

---

## 9. 验收标准（定量）

| 指标 | 门槛 | 测量方式 |
|------|------|----------|
| 结构类型准确率 | > 80% | 人工评审 50 条样本 |
| 分层准确率 (core/extended) | > 75% | 人工评审 50 条样本 |
| 边界识别准确率 | > 70% | 人工评审 50 条样本 |
| 置信度计算一致性 | > 85% | 与人工判断对比 |
| 前端渲染正确率 | 100% | 自动化测试 |
| 错误率 (运行时) | < 1% | 监控 |
| API 延迟增量 | < 2s | 性能监控 |

### 验收检查项

- [ ] 不同内容类型产出不同 summaryStructure
- [ ] keyPoints 正确分层 core/extended（向后兼容旧数据）
- [ ] boundaries 正确区分 applicable / notApplicable
- [ ] 前端根据 type 动态渲染（兼容新旧格式）
- [ ] 置信度正确计算（公式验证）
- [ ] Token 超限时正确截断/分块
- [ ] Feature Flag 降级正常
- [ ] 存量数据迁移脚本正确
- [ ] E2E 测试通过
- [ ] Canary 放量监控稳定

---

## 10. 后续扩展

- **置信度可视化**：显示来源可信度 × 内容完整度
- **结构推理理由展示**：让用户理解为什么这样总结
- **自定义结构**：用户可配置默认结构类型

