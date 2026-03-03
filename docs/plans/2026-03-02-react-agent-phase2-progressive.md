# ReAct Agent Phase 2 实施方案 - 渐进式工具激活

**版本**: v1.0
**日期**: 2026-03-02
**状态**: 待审阅
**基于**: Phase 1 已完成（v2.13）

---

## 一、实施策略

基于 15 轮迭代的教训，采用**渐进式实施**策略：

### 核心原则
1. **小步快跑**：每个子阶段独立验证，可随时回滚
2. **无新依赖**：基于现有 Vercel AI SDK，避免引入 LangGraph
3. **风险可控**：每步都有明确的验收标准和回退方案
4. **实际需求优先**：关注输出质量，而非理论完整性

---

## 二、Phase 2 分解

### Phase 2a: 激活工具系统（优先级：最高）

**目标**: 让现有的 8 个工具真正被 Agent 调用

**工作量**: 2-3h

**技术方案**:
```typescript
// 使用 Vercel AI SDK 的 tools 参数
const result = await generateObject({
  model: gemini,
  schema: DecisionSchema,
  tools: {
    check_duplicate: tool({
      description: '检查内容是否重复',
      parameters: z.object({ content: z.string() }),
      execute: async ({ content }) => {
        // 调用现有的 checkDuplication
      }
    }),
    find_relations: tool({
      description: '查找关联内容',
      parameters: z.object({ entryId: z.string() }),
      execute: async ({ entryId }) => {
        // 调用现有的 discoverAssociations
      }
    }),
    // ... 其他 6 个工具
  },
  maxSteps: 3, // 限制工具调用次数
});
```

**验收标准**:
- [ ] 工具定义从 `builtin-tools.ts` 迁移到 Vercel AI SDK 格式
- [ ] Agent 在处理时至少调用 1 个工具
- [ ] 工具调用结果记录在 `ReasoningTrace.steps`
- [ ] TypeScript 编译通过
- [ ] 单元测试覆盖工具调用路径

**风险评估**:
- 低风险：Vercel AI SDK 原生支持 tools，无需循环逻辑
- 回退方案：如果工具调用不稳定，可以禁用 tools 参数

---

### Phase 2b: 动态输出深度（优先级：高）

**目标**: 根据内容长度生成差异化的摘要结构

**工作量**: 2-3h

**技术方案**:
```typescript
// 根据内容长度动态调整 schema
function getDynamicSchema(contentLength: number) {
  if (contentLength < 500) {
    return ShortContentSchema; // 简化版
  } else if (contentLength < 2000) {
    return MediumContentSchema; // 标准版
  } else {
    return LongContentSchema; // 详细版
  }
}

// 填充 summaryStructure.fields
const summaryStructure = {
  type: 'tutorial',
  fields: {
    prerequisites: ['基础知识1', '基础知识2'],
    steps: ['步骤1', '步骤2', '步骤3'],
    examples: ['示例1', '示例2'],
  }
};
```

**验收标准**:
- [ ] 短文本（<500字）生成简化摘要
- [ ] 长文本（>2000字）生成详细摘要
- [ ] `summaryStructure.fields` 不再为空对象
- [ ] 手动测试 3 种长度的内容

**风险评估**:
- 低风险：纯逻辑改动，不涉及 API 变更
- 回退方案：保留原有固定 schema

---

### Phase 2c: 提示词优化（优先级：中）

**目标**: 引入 few-shot 示例，提升输出质量

**工作量**: 2-3h

**技术方案**:
```typescript
const systemPrompt = `
你是一个知识管理助手。

# Few-shot 示例

## 示例 1: 技术教程
输入: "如何使用 React Hooks..."
输出: {
  contentType: "tutorial",
  summaryStructure: {
    type: "tutorial",
    fields: {
      prerequisites: ["React 基础", "JavaScript ES6"],
      steps: ["创建组件", "使用 useState", "使用 useEffect"],
      examples: ["计数器示例", "数据获取示例"]
    }
  }
}

## 示例 2: 技术文章
...
`;
```

**验收标准**:
- [ ] 为 5 种常见内容类型添加 few-shot 示例
- [ ] 输出质量主观评估提升
- [ ] 不影响现有测试

**风险评估**:
- 低风险：只修改 prompt，不改代码逻辑
- 回退方案：恢复原有 prompt

---

### Phase 2d: 简单循环（优先级：可选）

**目标**: 实现简单的推理循环（非完整 ReAct）

**工作量**: 3-4h

**技术方案**:
```typescript
// 简单的两步推理
async function processWithLoop(entryId: string, input: ParseResult) {
  // Step 1: 快速分类 + 工具调用
  const classification = await generateObject({
    model: gemini,
    schema: ClassificationSchema,
    tools: { check_duplicate, find_relations },
    maxSteps: 2,
  });

  // Step 2: 基于工具结果深度提取
  const extraction = await generateObject({
    model: gemini,
    schema: ExtractionSchema,
    prompt: `基于以下工具调用结果：${classification.toolResults}...`,
  });

  return { classification, extraction };
}
```

**验收标准**:
- [ ] 实现两步推理：分类 → 提取
- [ ] 第二步能够使用第一步的工具调用结果
- [ ] 记录完整的推理链路

**风险评估**:
- 中风险：涉及流程改造，可能影响稳定性
- 回退方案：保持单步推理

---

## 三、实施顺序

```
Phase 2a (激活工具) → 验证 → Phase 2b (动态输出) → 验证 → Phase 2c (提示词) → 验证 → [可选] Phase 2d (循环)
     ↓                        ↓                        ↓                        ↓
  2-3h                     2-3h                     2-3h                     3-4h
```

**总工作量**: 6-12h（取决于是否实施 Phase 2d）

---

## 四、验证策略

每个子阶段完成后：

1. **TypeScript 编译检查**
   ```bash
   npx tsc --noEmit
   ```

2. **单元测试**
   ```bash
   npm run test
   ```

3. **手动测试**
   - 短文本（<500字）
   - 中等文本（500-2000字）
   - 长文本（>2000字）

4. **质量评估**
   - 工具调用成功率
   - `summaryStructure.fields` 填充率
   - 输出质量主观评分

---

## 五、与 Phase 1 的关系

Phase 1 已完成的接口重构为 Phase 2 提供了基础：

- ✅ `IAgentEngine` 接口：可以无缝切换 v1/v2 实现
- ✅ `createAgentEngine()` 工厂：可以通过环境变量控制版本
- ✅ 标准化的调用点：Inngest 和 API Route 已统一

Phase 2 的改动只需要：
1. 修改 `ReActAgent.process()` 方法内部实现
2. 不影响外部调用接口
3. 可以通过 feature flag 控制启用/禁用

---

## 六、风险控制

### 回退机制
```typescript
// 通过环境变量控制
const USE_TOOLS = process.env.REACT_AGENT_USE_TOOLS === 'true';
const USE_DYNAMIC_SCHEMA = process.env.REACT_AGENT_DYNAMIC_SCHEMA === 'true';

if (USE_TOOLS) {
  // Phase 2a 逻辑
} else {
  // Phase 1 逻辑
}
```

### 监控指标
- 工具调用成功率
- 平均处理时间
- 错误率
- 输出质量评分

---

## 七、Codex 评审结果（2026-03-02）

### 🔴 关键发现

1. **[High] API 假设错误**
   - 方案使用 `generateObject` + `tools`，但 `ai@6.0.105` 中 `generateObject` 已 deprecated
   - 应使用 `generateText` + `tools` + `stopWhen`
   - 需要修正 Phase 2a 技术方案

2. **[High] Phase 2d 收益低**
   - 当前已是两步推理（Step1 → Step2）
   - Phase 2d 与现有流程高度重叠
   - **决策：暂不实施，设为指标触发项**

3. **[High] 工具数量不一致**
   - 方案说 8 个工具，实际只注册了 7 个
   - 配置中有未实现工具（如 `find_relations`）
   - 2a 工时调整为 4-6h

4. **[Medium] 验收标准偏主观**
   - 缺少量化门槛和回归保护
   - 需要补充量化指标

### 📊 修正后的验收标准

**Phase 2a（工具激活）**：
- [ ] 工具调用成功率 >= 95%
- [ ] `normalizeAgentIngestDecision` 成功率 >= 98%
- [ ] `ReasoningTrace` 工具步骤记录完整率 = 100%
- [ ] P95 处理时延不劣化超过 25%
- [ ] 新增 `process()` 级测试，覆盖 3 条路径

**Phase 2b（动态输出）**：
- [ ] `summaryStructure.fields` 非空率 >= 90%
- [ ] 中长文本字段数中位数 >= 2
- [ ] 短/中/长文本差异化验证

**Phase 2c（提示词优化）**：
- [ ] 固定样本集（>= 30 条）综合分提升 >= 10%
- [ ] 不影响现有测试

### 🎯 实施节奏（最终方案）

**方案 B（每阶段验证）+ 短闭环**：
```
2a → 全量校验 → 2b → 回归 → 2c → 回归
```

**Codex 评审频率**：
- 2a：必做（API 适配风险高）
- 2b：可轻量（纯逻辑改动）
- 2c：必做（prompt 质量关键）
- 最终：整体验收

**Phase 2d 触发条件**（满足任一）：
1. 2a-2c 后 quality score P50 < 0.80
2. 工具上下文场景误判率仍高
3. fallback 比例未下降

### ⚠️ 风险控制

1. **补充 feature flag**：在 factory.ts 添加版本切换逻辑
2. **工具清单对齐**：先删除/补实现未注册工具
3. **工时调整**：2a 从 2-3h 调整为 4-6h

---

## 八、下一步行动

1. **修正 Phase 2a 方案**：使用 `generateText` API
2. **创建分支**：`codex/react-agent-phase2a`
3. **实施 Phase 2a**：激活工具系统（4-6h）
4. **Codex 评审**：完成后提交评审
5. **迭代推进**：根据验证结果决定 Phase 2b
