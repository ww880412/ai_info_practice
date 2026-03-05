# ReAct Agent Phase 2a 实施方案 - 工具系统激活（修正版）

**版本**: v1.2
**日期**: 2026-03-02
**状态**: 待实施
**基于**: Codex 第二轮评审结果

---

## 一、Codex 评审关键修正

### 修正 1: API 选择错误
- ❌ **错误方案**：`generateObject` + `tools` 参数
- ✅ **正确方案**：`generateText` + `tools` + `stopWhen` + `output`

**原因**：`ai@6.0.105` 中 `generateObject` 已 deprecated，不支持 `tools` 参数。

### 修正 2: 工具数量对齐
- 方案说 8 个工具，实际只注册了 7 个
- 配置中有未实现工具（`find_relations` 等）
- **先对齐工具清单再迁移**

### 修正 3: 工时调整
- 原估算：2-3h
- 修正后：**4-6h**（含 API 适配、测试、trace 对齐）

---

## 二、技术方案（修正版）

### 2.1 使用 generateText + output 模式

```typescript
import { generateText, Output, tool, stepCountIs } from 'ai';
import { z } from 'zod';

// 定义输出 schema（与 normalizeAgentIngestDecision 契约匹配）
const DecisionSchema = z.object({
  contentType: z.enum(['ARTICLE', 'TUTORIAL', 'DOCUMENTATION', 'CODE_SNIPPET', 'DISCUSSION', 'OTHER']),
  techDomain: z.string(), // 单个字符串，不是数组
  aiTags: z.array(z.string()),
  coreSummary: z.string(), // 必填字段
  keyPoints: z.array(z.string()),
  boundaries: z.object({
    whatItIs: z.string(),
    whatItIsNot: z.string(),
  }),
  practiceValue: z.number().min(0).max(10), // 必填字段
  practiceTask: z.object({
    description: z.string(),
    difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']),
  }).optional(),
});

// 定义工具（使用 inputSchema 而不是 parameters）
const tools = {
  check_duplicate: tool({
    description: '检查内容是否与已有条目重复',
    inputSchema: z.object({
      content: z.string().describe('要检查的内容'),
    }),
    execute: async ({ content }) => {
      const similar = await findSimilarEntries(content);
      return {
        isDuplicate: similar.length > 0,
        similarEntries: similar.map(e => ({
          id: e.id,
          title: e.title,
          similarity: e.similarity,
        })),
      };
    },
  }),

  extract_code: tool({
    description: '从内容中提取代码片段',
    inputSchema: z.object({
      content: z.string().describe('包含代码的内容'),
    }),
    execute: async ({ content }) => {
      // 实现代码提取逻辑
      const codeBlocks = extractCodeBlocks(content);
      return {
        codeBlocks,
        languages: [...new Set(codeBlocks.map(b => b.language))],
      };
    },
  }),

  // ... 其他工具
};

// 使用 generateText + output
const result = await generateText({
  model: gemini,
  system: '你是一个知识管理助手...',
  prompt: `分析以下内容：\n\n${content}`,
  tools,
  toolChoice: 'auto', // 让模型自动决定是否调用工具
  stopWhen: stepCountIs(3), // 最多 3 步
  output: Output.object({
    schema: DecisionSchema,
  }),
});

// 访问结果
const decision = result.output; // 类型安全的输出
const toolCalls = result.steps.flatMap(step => step.toolCalls || []);
```

### 2.2 工具清单对齐

**当前已注册工具**（7 个）：
1. `evaluate_dimension` - 评估维度
2. `classify_content` - 内容分类
3. `extract_summary` - 摘要提取
4. `extract_code` - 代码提取
5. `extract_version` - 版本信息提取
6. `check_duplicate` - 去重检测
7. `route_to_strategy` - 路由策略

**配置中未实现工具**（需要补实现或删除）：
- `find_relations` - 关联发现
- `generate_practice` - 练习生成
- `extract_notes` - 笔记提取
- `store_knowledge` - 知识存储

**决策**：
- Phase 2a 只激活已实现的 7 个工具
- 未实现工具从配置中移除，避免调用失败

### 2.3 ReasoningTrace 适配

```typescript
import type { ToolCall, ToolResult } from 'ai';

interface ReasoningStep {
  step: number;
  thought: string;
  action: string;
  observation: string;
  reasoning: string;
  timestamp: string; // 必填字段
  context?: Record<string, unknown>; // 可选上下文
  toolCalls?: Array<{
    toolName: string;
    input: Record<string, unknown>; // 使用 input 而不是 args
    output: unknown; // 使用 output 而不是 result
  }>;
}

// 从 generateText 结果构建 trace
function buildReasoningTrace(result: GenerateTextResult<DecisionSchema>): ReasoningTrace {
  const steps: ReasoningStep[] = result.steps.map((step, index) => {
    const toolCalls = step.toolCalls?.map((tc: ToolCall) => {
      const toolResult = step.toolResults?.find((tr: ToolResult) => tr.toolCallId === tc.toolCallId);
      return {
        toolName: tc.toolName,
        input: tc.input, // SDK 使用 input 字段
        output: toolResult?.output, // SDK 使用 output 字段
      };
    });

    return {
      step: index + 1,
      thought: step.text || '',
      action: step.toolCalls?.[0]?.toolName || 'none',
      observation: JSON.stringify(step.toolResults || {}),
      reasoning: step.text || '',
      timestamp: new Date().toISOString(),
      context: {
        stepType: step.toolCalls?.length ? 'tool_call' : 'reasoning',
      },
      toolCalls,
    };
  });

  return {
    steps,
    finalResult: result.output,
    metadata: {
      totalSteps: steps.length,
      toolCallCount: steps.filter(s => s.toolCalls?.length).length,
      model: 'gemini-2.0-flash-exp',
      timestamp: new Date().toISOString(),
    },
  };
}
```

---

## 三、实施步骤

### Step 1: 工具清单对齐（30min）

1. 从 `config.ts` 中移除未实现工具：
```typescript
// src/lib/ai/agent/config.ts
export function getDefaultConfig(): AgentConfig {
  return {
    // ...
    availableTools: [
      'evaluate_dimension',
      'classify_content',
      'extract_summary',
      'extract_code',
      'extract_version',
      'check_duplicate',
      'route_to_strategy',
    ],
    maxIterations: 3, // 降低为 3，避免过多循环
  };
}
```

2. 验证所有工具都已注册：
```bash
npm run test -- src/lib/ai/agent/builtin-tools.test.ts
```

### Step 2: 迁移到 generateText API（2-3h）

**迁移路径决策**：直接在 `engine.ts` 中使用 `ai.generateText`，不升级 `src/lib/ai/generate.ts` 封装（该封装当前签名是 `generateText(prompt: string)`，与对象参数不兼容）。

1. 修改 `engine.ts` 中的 `executeReasoning` 方法
2. 将工具从 `toolsRegistry` 格式转换为 Vercel AI SDK 格式
3. 使用 `generateText` + `output` 替代当前实现
4. 适配 `ReasoningTrace` 结构

### Step 3: 添加 feature flag（30min）

```typescript
// src/lib/ai/agent/factory.ts
export async function createAgentEngine(): Promise<IAgentEngine> {
  const config = await getAgentConfig();

  const useTools = process.env.REACT_AGENT_USE_TOOLS === 'true';

  if (useTools) {
    // 使用带工具调用的版本（Phase 2a 实现）
    return new ReActAgent(config); // 复用现有类，内部根据 config 判断
  }

  return new ReActAgent(config); // Phase 1 版本
}
```

**注意**：不创建新的 `ReActAgentV2` 类，而是在现有 `ReActAgent` 内部根据配置切换行为。

### Step 4: 测试覆盖（1-2h）

```typescript
// src/lib/ai/agent/engine.test.ts
describe('ReActAgent with tools', () => {
  it('should call check_duplicate tool when content is similar', async () => {
    // 测试工具调用成功路径
  });

  it('should fallback when tool call fails', async () => {
    // 测试工具调用失败回退
  });

  it('should work without tool calls', async () => {
    // 测试无工具调用路径
  });
});
```

### Step 5: 验证（30min）

1. TypeScript 编译：`npx tsc --noEmit`
2. 单元测试：`npm run test`
3. 手动测试：3 种内容类型

---

## 四、验收标准（量化版）

### 功能验收
- [ ] 工具定义从 `toolsRegistry` 迁移到 Vercel AI SDK 格式
- [ ] Agent 在处理时至少调用 1 个工具（可配置）
- [ ] 工具调用结果记录在 `ReasoningTrace.steps`
- [ ] TypeScript 编译通过
- [ ] 单元测试覆盖 3 条路径

### 质量指标
- [ ] 工具调用成功率 >= 95%
- [ ] `normalizeAgentIngestDecision` 成功率 >= 98%
- [ ] `ReasoningTrace` 工具步骤记录完整率 = 100%
- [ ] P95 处理时延不劣化超过 25%
- [ ] 失败率不升高

### 回退方案
- [ ] Feature flag 可以快速关闭工具调用
- [ ] 关闭后回退到 Phase 1 行为
- [ ] 不影响现有数据

---

## 五、风险控制

### 风险 1: API 适配复杂度
- **缓解**：先在测试环境验证 `generateText` + `output` 组合
- **回退**：保留 Phase 1 代码路径

### 风险 2: 工具调用不稳定
- **缓解**：每个工具都有 try-catch + 降级逻辑
- **监控**：记录工具调用成功率

### 风险 3: 性能劣化
- **缓解**：`maxIterations` 降低为 3
- **监控**：P95 处理时延

---

## 六、下一步

1. ✅ Codex 评审通过
2. ⏳ 创建分支：`codex/react-agent-phase2a`
3. ⏳ 实施 Step 1-5（预计 4-6h）
4. ⏳ 提交 Codex 评审
5. ⏳ 合并到 main

---

**工作量估算**：4-6h
**风险等级**：Medium（API 适配有一定复杂度）
**优先级**：High（工具激活是后续优化的基础）
