# Mode Comparison 评分系统问题分析与优化方案

> 分析时间：2026-03-08
> 批次 ID：72a7a9702b4a4cfd9b0161d7d（成功）
> 问题批次：cmmhc8o4u000013yit4tr79hl, 51a71611f07646ae9bd1ab1a1, 8de091d43f434d6f803f2e225, c0221da6e87c450294206e3bd, 327cd6ffcfd14ff5b7a4074b8（失败）

## 问题概述

在实施 mode-comparison 功能时，评分系统（`scoring-agent.ts`）遇到了多次失败，主要原因是 CRS Provider 返回的 JSON 格式与预期不符。

## 问题详情

### 1. Schema 验证失败

**错误信息**：
```
Error [AI_TypeValidationError]: Type validation failed
"Too big: expected array to have <=5 items"
```

**根本原因**：
- AI 模型（CRS）在评分时返回的 `issues` 和 `suggestions` 数组经常超过 schema 定义的限制
- 初始限制：`issues` 最多 10 个，`suggestions` 最多 5 个
- 实际返回：经常有 8-10 个 suggestions

**影响**：
- 批次处理失败率 100%（前 5 个批次全部失败）
- 用户无法看到对比结果

### 2. JSON 解析失败

**错误信息**：
```
Error [AI_JSONParseError]: JSON parsing failed: Text: ```json
Unexpected token '`', "```json
```

**根本原因**：
- CRS Provider 在使用 structured output 时，仍然返回 markdown 代码块包裹的 JSON
- Vercel AI SDK 的 `generateObject` 无法处理这种格式
- 虽然 `generateJSON` 有清理逻辑，但在 `generateObject` 内部就已经抛出错误

**影响**：
- 即使 schema 验证通过，JSON 解析也会失败
- 错误发生在 Vercel AI SDK 内部，难以捕获

### 3. 代码缓存问题

**错误信息**：
修改代码后重启应用，但错误仍然存在

**根本原因**：
- Next.js 使用了构建缓存（`.next` 目录）
- 简单重启容器不会重新构建代码
- 需要重新构建 Docker 镜像才能应用最新代码

**影响**：
- 调试周期延长
- 多次尝试失败后才发现是缓存问题

## 解决方案

### 临时方案（已实施）

#### 1. 放宽 Schema 限制

```typescript
// src/lib/ai/agent/scoring-agent.ts
export const QualityEvaluationSchema = z.object({
  overallScore: z.number().min(0).max(100),
  dimensions: z.object({
    completeness: z.number().min(0).max(100),
    accuracy: z.number().min(0).max(100),
    relevance: z.number().min(0).max(100),
    clarity: z.number().min(0).max(100),
    actionability: z.number().min(0).max(100).nullable(),
  }),
  issues: z.array(z.string()).max(20),        // 从 10 增加到 20
  suggestions: z.array(z.string()).max(20),   // 从 5 增加到 20
  reasoning: z.string().min(100).max(2000),   // 从 1000 增加到 2000
});
```

**优点**：
- 快速解决 schema 验证失败问题
- 允许 AI 返回更详细的评分反馈

**缺点**：
- 治标不治本，没有解决 AI 返回过多内容的根本原因
- 可能导致前端展示过于冗长

#### 2. 绕过 generateObject

```typescript
// src/lib/ai/agent/scoring-agent.ts
export async function evaluateDecisionQuality(
  input: ScoringInput
): Promise<QualityEvaluation> {
  const { decision, originalContent } = input;
  const prompt = buildScoringPrompt(decision, originalContent);

  // 使用 generateText 代替 generateJSON
  const { generateText } = await import('@/lib/ai/generate');
  const text = await generateText(prompt);

  // 手动清理 markdown 代码块
  let jsonText = text.trim();
  if (jsonText.startsWith('```')) {
    jsonText = jsonText.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?\s*```\s*$/, '');
  }
  jsonText = jsonText.trim();

  // 解析并验证
  const parsed = JSON.parse(jsonText);
  const result = QualityEvaluationSchema.parse(parsed);

  return result;
}
```

**优点**：
- 绕过 Vercel AI SDK 的 `generateObject`，避免内部错误
- 可以手动控制 JSON 清理逻辑

**缺点**：
- 失去了 structured output 的类型安全保证
- 需要手动处理解析错误

#### 3. 增强 Prompt

```typescript
**重要**：请直接返回 JSON 对象，不要使用 markdown 代码块包裹。
```

**优点**：
- 明确告诉 AI 不要使用 markdown 包裹

**缺点**：
- 效果有限，CRS 仍然可能返回 markdown 包裹的 JSON

### 长期优化方案

#### 方案 A：切换评分模型

**建议**：使用 Gemini 或其他支持 structured output 的模型进行评分

**优点**：
- Gemini 对 structured output 支持更好
- 可以使用 `generateObject` 获得类型安全
- 减少 JSON 解析错误

**缺点**：
- 需要配置多个 API key
- 增加系统复杂度

**实施步骤**：
1. 在 `scoring-agent.ts` 中添加模型选择逻辑
2. 为评分任务单独配置 Gemini API
3. 保留 CRS 用于主要的 Agent 推理

#### 方案 B：改进 Prompt 设计

**建议**：优化评分 prompt，减少 AI 返回的 issues 和 suggestions 数量

**优点**：
- 不需要修改代码
- 提高评分质量（更聚焦核心问题）

**缺点**：
- 需要多次迭代测试
- 可能降低评分的详细程度

**实施步骤**：
1. 修改 prompt，明确要求只返回最重要的 3-5 个 issues
2. 要求 suggestions 与 issues 一一对应
3. 增加示例（few-shot）展示期望的输出格式

#### 方案 C：后处理截断

**建议**：在 schema 验证前，自动截断超长的数组

**优点**：
- 简单可靠
- 不依赖 AI 模型行为

**缺点**：
- 可能丢失重要信息
- 治标不治本

**实施步骤**：
```typescript
// 在 parse 之前截断
if (parsed.issues && parsed.issues.length > 10) {
  parsed.issues = parsed.issues.slice(0, 10);
}
if (parsed.suggestions && parsed.suggestions.length > 10) {
  parsed.suggestions = parsed.suggestions.slice(0, 10);
}
```

#### 方案 D：分离评分和详细反馈

**建议**：将评分和详细反馈分为两个独立的步骤

**优点**：
- 评分可以使用 structured output（只返回分数）
- 详细反馈可以使用 text generation（允许更灵活的格式）
- 提高可靠性

**缺点**：
- 增加 API 调用次数
- 增加处理时间

**实施步骤**：
1. 第一步：只返回 `overallScore` 和 `dimensions`
2. 第二步：基于分数生成详细的 `issues`、`suggestions` 和 `reasoning`
3. 合并两次结果

## 性能影响

### 当前性能

- **单次对比耗时**：10-15 分钟
  - 重新处理 entry：5-10 分钟
  - 评分原始决策：2-3 分钟
  - 评分新决策：2-3 分钟
  - 计算统计：<1 分钟

- **失败率**：
  - 修复前：100%（5/5 批次失败）
  - 修复后：0%（1/1 批次成功）

### 优化后预期

如果采用方案 A（切换评分模型）：
- 评分耗时可能减少 30-50%
- 失败率接近 0%

如果采用方案 D（分离评分和反馈）：
- 评分耗时增加 20-30%
- 但可靠性大幅提升

## 建议优先级

1. **P0（立即实施）**：保持当前临时方案，确保功能可用
2. **P1（本周）**：实施方案 B（改进 Prompt），减少返回内容
3. **P2（下周）**：实施方案 A（切换评分模型），提升可靠性
4. **P3（未来）**：考虑方案 D（分离评分和反馈），进一步优化

## 相关文件

- `src/lib/ai/agent/scoring-agent.ts` - 评分 Agent 实现
- `src/lib/ai/agent/comparison.ts` - 对比逻辑
- `src/lib/inngest/functions/process-comparison-batch.ts` - 批次处理
- `docs/analysis/mode-comparison-e2e-analysis.md` - 端到端对比分析

## 测试建议

1. **单元测试**：为 `evaluateDecisionQuality` 添加测试，覆盖各种边界情况
2. **集成测试**：测试完整的对比流程，包括失败重试
3. **性能测试**：监控评分耗时，设置超时告警
4. **回归测试**：每次修改后运行完整的对比流程

## 总结

通过放宽 schema 限制和绕过 `generateObject`，我们成功解决了 mode-comparison 评分系统的阻塞问题。但这只是临时方案，长期来看应该：

1. 改进 prompt 设计，减少 AI 返回的冗余内容
2. 切换到更可靠的评分模型（Gemini）
3. 考虑分离评分和详细反馈，提高系统可靠性

当前方案已经可以正常工作，用户可以查看对比结果。后续优化可以根据实际使用情况和优先级逐步实施。
