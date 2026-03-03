# ReAct Agent 核心升级方案

**版本**: v1.0
**日期**: 2026-03-01
**状态**: 待审阅
**作者**: Claude Opus 4.6

---

## 一、问题诊断

### 1.1 当前架构问题

经过系统性代码审查，发现以下核心问题：

| 问题 | 现状 | 影响 |
|------|------|------|
| **伪 ReAct 实现** | `engine.ts` 只是顺序调用两次 LLM，无循环推理 | 无法根据中间结果动态调整路径 |
| **工具系统未使用** | `builtin-tools.ts` 定义了 8 个工具，但从未被调用 | 去重、关联发现等能力形同虚设 |
| **结构化输出空置** | `schemas.ts` 定义了 9 种结构类型，但 `summaryStructure.fields` 始终为 `{}` | 无法根据内容类型生成差异化输出 |
| **提示词简单** | 纯指令式，无 few-shot 示例，不同内容类型处理雷同 | 输出质量不稳定，长短文本差异不明显 |

### 1.2 真假 ReAct 判别标准

根据 2025-2026 年行业最佳实践，真正的 ReAct Agent 需要：

```
真 ReAct 特征：
✓ think → act (调用工具) → observe → reflect 的迭代循环
✓ 模型根据观察结果决定下一步（动态路径）
✓ 工具真的被调用，且结果影响后续推理
✓ 有循环结构（while/for），而非固定步骤

伪 ReAct 特征：
✗ 顺序调用 N 步 LLM，步骤固定
✗ 定义了工具但 engine 从未调用
✗ 定义了 schema 但输出始终为空对象
✗ 无循环，无条件分支
```

---

## 二、升级目标

### 2.1 核心目标

1. **真正的 ReAct 循环**：实现 Reasoning → Action → Observation 的迭代推理
2. **工具系统激活**：让 `check_duplicate`、`find_relations`、`extract_code` 等工具真正被调用
3. **动态输出深度**：根据内容长度和类型，生成差异化的摘要结构
4. **提示词优化**：引入 few-shot 示例，填充 `summaryStructure.fields`

### 2.2 非目标（本次不做）

- ❌ 多 Agent 协作（保持单 Agent）
- ❌ 长期记忆系统（保持 stateless）
- ❌ 流式输出优化（保持现有 Inngest 异步处理）

---

## 三、技术方案

### 3.1 架构选型：LangGraph vs 自研

基于调研结果，推荐方案：

| 方案 | 优势 | 劣势 | 推荐度 |
|------|------|------|--------|
| **LangGraph** | 成熟的 ReAct 实现，内置 checkpointer、工具调用、循环控制 | 引入新依赖，学习成本 | ⭐⭐⭐⭐⭐ |
| **Vercel AI SDK 原生** | 已集成，支持 `tools` + `maxSteps` | 需要手动实现循环逻辑 | ⭐⭐⭐ |
| **自研循环引擎** | 完全可控 | 开发成本高，容易踩坑 | ⭐⭐ |

**推荐：采用 LangGraph + Vercel AI SDK 混合方案**

理由：
1. LangGraph 的 `create_react_agent` 提供开箱即用的 ReAct 循环
2. Vercel AI SDK 的 `generateObject` 保持现有类型安全优势
3. 两者可以共存：LangGraph 负责推理循环，Vercel AI SDK 负责结构化输出

### 3.2 核心架构设计

```typescript
// 新架构：三层推理
┌─────────────────────────────────────────────────────────┐
│  Layer 1: ReAct Loop (LangGraph)                        │
│  ┌─────────────────────────────────────────────────┐   │
│  │ think → act → observe → reflect (max 5 steps)   │   │
│  │ 工具: check_duplicate, find_relations, ...      │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  Layer 2: Content Classification (Vercel AI SDK)        │
│  ┌─────────────────────────────────────────────────┐   │
│  │ 基于 Layer 1 的观察结果，快速分类               │   │
│  │ 输出: contentType, techDomain, summaryStructure │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  Layer 3: Deep Extraction (Vercel AI SDK)               │
│  ┌─────────────────────────────────────────────────┐   │
│  │ 根据 summaryStructure.type 动态填充 fields      │   │
│  │ 输出: 完整的 NormalizedAgentIngestDecision      │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### 3.3 工具系统重构

#### 3.3.1 工具定义标准化

```typescript
// src/lib/ai/agent/tools-v2.ts
import { tool } from 'ai';
import { z } from 'zod';

export const checkDuplicateTool = tool({
  description: '检查数据库中是否存在相似内容，返回相似度分数和匹配条目',
  parameters: z.object({
    content: z.string().describe('要检查的内容'),
    threshold: z.number().default(0.7).describe('相似度阈值 (0-1)'),
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
});

export const findRelationsTool = tool({
  description: '发现内容与现有知识库的关联关系',
  parameters: z.object({
    content: z.string(),
    maxResults: z.number().default(5),
  }),
  execute: async ({ content, maxResults }) => {
    const relations = await discoverAssociations(content, maxResults);
    return {
      relatedEntries: relations.map(r => ({
        id: r.id,
        title: r.title,
        relationshipType: r.type, // 'prerequisite' | 'extension' | 'alternative'
        confidence: r.confidence,
      })),
    };
  },
});

export const extractCodeTool = tool({
  description: '从教程内容中提取代码示例',
  parameters: z.object({
    content: z.string(),
  }),
  execute: async ({ content }) => {
    // 使用正则 + AI 提取代码块
    const codeBlocks = extractCodeBlocks(content);
    return {
      hasCode: codeBlocks.length > 0,
      examples: codeBlocks.map(block => ({
        language: block.language,
        code: block.code,
        lineCount: block.code.split('\n').length,
      })),
    };
  },
});
```

#### 3.3.2 工具调用策略

```typescript
// src/lib/ai/agent/tool-strategy.ts
export function selectToolsForContent(input: {
  sourceType: string;
  contentLength: number;
  title: string;
}): string[] {
  const tools: string[] = [];

  // 所有内容都检查去重
  tools.push('check_duplicate');

  // 长内容才做关联发现（节省成本）
  if (input.contentLength > 5000) {
    tools.push('find_relations');
  }

  // 教程类内容提取代码
  if (input.title.match(/tutorial|guide|how to/i)) {
    tools.push('extract_code');
  }

  return tools;
}
```

### 3.4 ReAct 循环实现

#### 3.4.1 使用 LangGraph 的 create_react_agent

```typescript
// src/lib/ai/agent/react-engine.ts
import { create_react_agent } from '@langchain/langgraph/prebuilt';
import { ChatOpenAI } from '@langchain/openai';
import { MemorySaver } from '@langchain/langgraph';

export async function runReActLoop(input: {
  content: string;
  title: string;
  sourceType: string;
}) {
  // 1. 选择工具
  const selectedTools = selectToolsForContent(input);
  const tools = selectedTools.map(name => toolRegistry[name]);

  // 2. 创建 ReAct Agent
  const model = new ChatOpenAI({
    modelName: 'gpt-4o',
    temperature: 0,
  });

  const agent = create_react_agent({
    model,
    tools,
    checkpointer: new MemorySaver(), // 短期记忆
    prompt: buildReActPrompt(input),
  });

  // 3. 运行循环（最多 5 步）
  const config = {
    configurable: { thread_id: `ingest-${Date.now()}` },
    recursion_limit: 5,
  };

  const result = await agent.invoke(
    {
      messages: [
        {
          role: 'user',
          content: `分析以下内容并决定需要调用哪些工具：\n\n标题: ${input.title}\n长度: ${input.content.length}\n\n内容片段:\n${input.content.slice(0, 2000)}`,
        },
      ],
    },
    config
  );

  // 4. 提取工具调用结果
  return {
    toolCalls: result.messages.filter(m => m.type === 'tool'),
    observations: extractObservations(result.messages),
    finalThought: result.messages[result.messages.length - 1].content,
  };
}

function buildReActPrompt(input: any): string {
  return `你是知识入库分析专家。你的任务是：

1. 分析内容特征（长度、类型、来源）
2. 决定需要调用哪些工具来辅助分析
3. 根据工具返回的结果，形成最终判断

可用工具：
- check_duplicate: 检查是否有重复内容
- find_relations: 发现与现有知识的关联
- extract_code: 提取代码示例（仅教程类）

推理步骤：
1. Thought: 我需要了解什么信息？
2. Action: 调用工具获取信息
3. Observation: 工具返回了什么？
4. Reflection: 这些信息如何影响我的判断？
5. 重复 1-4 直到有足够信息

最终输出：
- 是否重复（如果是，停止处理）
- 关联条目 ID 列表
- 是否包含代码示例
- 推荐的处理策略`;
}
```

#### 3.4.2 与现有流程集成

```typescript
// src/lib/ai/agent/engine-v2.ts
export class ReactAgentEngine {
  async process(input: AgentInput): Promise<NormalizedAgentIngestDecision> {
    // Step 0: ReAct 循环（新增）
    const reactResult = await runReActLoop(input);

    // 如果发现重复，直接返回
    if (reactResult.observations.hasDuplicate) {
      return {
        shouldIngest: false,
        reason: 'Duplicate content detected',
        duplicateOf: reactResult.observations.duplicateId,
      };
    }

    // Step 1: 快速分类（保留，但增强 prompt）
    const classification = await this.classifyWithContext({
      ...input,
      reactObservations: reactResult.observations, // 传入 ReAct 结果
    });

    // Step 2: 深度提取（保留，但动态填充 fields）
    const extraction = await this.extractWithStructure({
      ...input,
      classification,
      reactObservations: reactResult.observations,
    });

    // Step 3: 合并结果
    return this.mergeResults(classification, extraction, reactResult);
  }
}
```

### 3.5 动态输出深度

#### 3.5.1 内容长度分级策略

```typescript
// src/lib/ai/agent/output-strategy.ts
export function determineOutputDepth(contentLength: number): {
  corePoints: number;
  extendedPoints: number;
  summaryLength: 'short' | 'medium' | 'long';
} {
  if (contentLength < 3000) {
    return {
      corePoints: 3,
      extendedPoints: 1,
      summaryLength: 'short', // 100-150 字
    };
  } else if (contentLength < 10000) {
    return {
      corePoints: 5,
      extendedPoints: 2,
      summaryLength: 'medium', // 200-300 字
    };
  } else {
    return {
      corePoints: 8,
      extendedPoints: 4,
      summaryLength: 'long', // 400-600 字
    };
  }
}
```

#### 3.5.2 填充 summaryStructure.fields

```typescript
// src/lib/ai/agent/structure-filler.ts
export async function fillStructureFields(
  structureType: string,
  content: string,
  depth: OutputDepth
): Promise<Record<string, any>> {
  const schema = STRUCTURE_SCHEMAS[structureType];
  if (!schema) return {};

  // 根据 schema 动态生成 prompt
  const prompt = `根据以下内容，提取 ${structureType} 结构的字段：

内容：
${content.slice(0, 20000)}

要求：
- coreSummary: ${depth.summaryLength === 'short' ? '100-150字' : depth.summaryLength === 'medium' ? '200-300字' : '400-600字'}
- keyPoints.core: ${depth.corePoints} 条
- keyPoints.extended: ${depth.extendedPoints} 条

返回严格 JSON：
${JSON.stringify(schema, null, 2)}`;

  return await generateJSON(prompt, schema);
}
```

### 3.6 提示词优化

#### 3.6.1 Few-Shot 示例库

```typescript
// src/lib/ai/agent/few-shot-examples.ts
export const FEW_SHOT_EXAMPLES = {
  'problem-solution-steps': {
    input: {
      title: 'How to Fix "Module Not Found" Error in Next.js',
      content: '...',
    },
    output: {
      summaryStructure: {
        type: 'problem-solution-steps',
        fields: {
          problem: 'Next.js 项目中出现 "Module not found" 错误',
          rootCause: '路径别名配置不正确或 tsconfig.json 未同步',
          solution: '更新 tsconfig.json 的 paths 配置并重启开发服务器',
          steps: [
            { order: 1, action: '检查 tsconfig.json 中的 paths 配置' },
            { order: 2, action: '确保 baseUrl 设置为 "."' },
            { order: 3, action: '重启 next dev' },
          ],
          preventionTips: ['使用绝对路径导入', '定期同步 tsconfig 和 next.config'],
        },
      },
    },
  },
  'concept-mechanism-flow': {
    input: {
      title: 'Understanding React Server Components',
      content: '...',
    },
    output: {
      summaryStructure: {
        type: 'concept-mechanism-flow',
        fields: {
          concept: 'React Server Components (RSC)',
          definition: '在服务端渲染的 React 组件，不包含客户端 JavaScript',
          mechanism: 'RSC 在服务端执行，生成序列化的 UI 描述传递给客户端',
          dataFlow: [
            '服务端: 执行 RSC → 生成 React 元素树',
            '序列化: 转换为 JSON 格式',
            '客户端: 反序列化 → 渲染 UI',
          ],
          keyDifferences: {
            vs_SSR: 'SSR 渲染 HTML，RSC 渲染 React 元素',
            vs_ClientComponent: 'RSC 无 hydration 成本',
          },
        },
      },
    },
  },
};
```

#### 3.6.2 动态注入示例

```typescript
// src/lib/ai/agent/prompt-builder.ts
export function buildPromptWithExamples(
  structureType: string,
  input: AgentInput
): string {
  const example = FEW_SHOT_EXAMPLES[structureType];
  if (!example) {
    return buildBasicPrompt(input);
  }

  return `你是知识提取专家。参考以下示例，提取相同结构的内容。

【示例输入】
标题: ${example.input.title}
内容: ${example.input.content.slice(0, 500)}...

【示例输出】
${JSON.stringify(example.output, null, 2)}

【实际任务】
标题: ${input.title}
内容: ${input.content.slice(0, 20000)}

请按相同格式输出 JSON。`;
}
```

---

## 四、实施计划

### 4.1 阶段划分

| 阶段 | 任务 | 工作量 | 依赖 |
|------|------|--------|------|
| **Phase 1: 基础设施** | 安装 LangGraph，重构工具定义 | 2-3 小时 | - |
| **Phase 2: ReAct 循环** | 实现 `runReActLoop`，集成到 engine | 4-5 小时 | Phase 1 |
| **Phase 3: 动态输出** | 实现 `fillStructureFields`，优化 prompt | 3-4 小时 | Phase 2 |
| **Phase 4: Few-Shot** | 构建示例库，动态注入 | 2-3 小时 | Phase 3 |
| **Phase 5: 测试验证** | 端到端测试，性能优化 | 3-4 小时 | Phase 4 |

**总工作量**: 14-19 小时

### 4.2 风险控制

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| LangGraph 学习曲线 | 延期 1-2 天 | 先跑通官方示例，再集成 |
| Token 成本增加 | 成本 +30% | 设置 `recursion_limit=5`，缓存工具结果 |
| 输出格式不稳定 | 解析失败 | 使用 Zod 严格校验，fallback 到简化版 |
| 性能下降 | 处理时间 +50% | 异步处理（已有 Inngest），用户无感知 |

### 4.3 回滚策略

保留现有 `engine.ts` 为 `engine-legacy.ts`，通过环境变量切换：

```typescript
// src/lib/ai/agent/index.ts
export function createAgentEngine() {
  if (process.env.USE_REACT_V2 === 'true') {
    return new ReactAgentEngineV2();
  }
  return new ReactAgentEngine(); // legacy
}
```

---

## 五、验证标准

### 5.1 功能验证

| 测试场景 | 预期结果 | 验证方法 |
|----------|----------|----------|
| **短文本 (< 3000 字)** | core 3 条，extended 1 条，summary 100-150 字 | 入库 10 篇短文，检查输出 |
| **长文本 (> 10000 字)** | core 8 条，extended 4 条，summary 400-600 字 | 入库 10 篇长文，检查输出 |
| **重复内容** | 调用 `check_duplicate`，返回 `shouldIngest: false` | 入库已存在内容 |
| **教程类内容** | 调用 `extract_code`，填充 `codeExamples` | 入库 React 教程 |
| **工具调用** | 每次入库至少调用 1 个工具 | 检查 Inngest 日志 |

### 5.2 性能验证

| 指标 | 目标 | 测量方法 |
|------|------|----------|
| 平均处理时间 | < 30 秒 | Inngest dashboard |
| Token 消耗 | < 20k tokens/entry | OpenAI usage API |
| 工具调用次数 | 1-3 次/entry | 日志统计 |
| 成功率 | > 95% | 错误率监控 |

### 5.3 质量验证

人工抽查 50 条入库结果，评估：

- ✅ `summaryStructure.fields` 是否填充（非空对象）
- ✅ 摘要长度是否符合内容长度
- ✅ keyPoints 数量是否符合预期
- ✅ 工具调用是否合理（无冗余调用）

---

## 六、成本估算

### 6.1 开发成本

- 工程师时间: 14-19 小时 × 1 人 = **2-3 个工作日**
- 测试时间: 4-6 小时 = **0.5-1 个工作日**

**总计**: 2.5-4 个工作日

### 6.2 运行成本

假设每天入库 100 条内容：

| 项目 | 现状 | 升级后 | 增量 |
|------|------|--------|------|
| LLM 调用次数 | 2 次/entry | 3-5 次/entry | +50-150% |
| Token 消耗 | 10k/entry | 15k/entry | +50% |
| 月成本 (100 条/天) | $30 | $45 | +$15 |

**结论**: 成本增加可控，换取显著的质量提升。

---

## 七、后续优化方向

### 7.1 短期优化 (1-2 周)

1. **工具结果缓存**: 相同内容的 `check_duplicate` 结果缓存 24 小时
2. **并行工具调用**: `check_duplicate` 和 `find_relations` 并行执行
3. **Prompt 压缩**: 使用 LLMLingua 压缩长文本

### 7.2 中期优化 (1-2 月)

1. **多模态支持**: 图片内容调用 `image_multimodal` 工具
2. **增量学习**: 根据用户反馈调整 few-shot 示例
3. **A/B 测试**: 对比 ReAct vs 固定流程的效果差异

### 7.3 长期优化 (3-6 月)

1. **多 Agent 协作**: 分类 Agent + 提取 Agent + 验证 Agent
2. **长期记忆**: 集成 LangMem，跨会话记忆用户偏好
3. **自适应策略**: 根据内容类型自动选择最优工具组合

---

## 八、参考资料

### 8.1 行业最佳实践

1. **LangGraph ReAct 实现**: [LangChain 官方文档](https://langchain-ai.github.io/langgraph/)
2. **Vercel AI SDK 工具调用**: [AI SDK Core - Tools](https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling)
3. **ReAct 模式详解**: [Building Production ReAct Agents](https://www.decodingai.com/p/building-production-react-agents)
4. **多步推理优化**: [AI Agents in Production 2026](https://47billion.com/blog/ai-agents-in-production-frameworks-protocols-and-what-actually-works-in-2026/)

### 8.2 技术选型依据

- **LangGraph vs 自研**: LangGraph 提供成熟的 checkpointer、循环控制、错误处理
- **Vercel AI SDK 保留**: 类型安全、流式输出、与 Next.js 深度集成
- **混合方案**: 发挥两者优势，避免重复造轮子

---

## 九、决策点

请审阅以下关键决策，确认后开始实施：

### ✅ 需要确认的决策

1. **是否采用 LangGraph**？
   - [ ] 是，引入 LangGraph（推荐）
   - [ ] 否，基于 Vercel AI SDK 自研循环

2. **ReAct 循环最大步数**？
   - [ ] 3 步（快速，成本低）
   - [ ] 5 步（平衡，推荐）
   - [ ] 10 步（深度，成本高）

3. **工具调用策略**？
   - [ ] 所有内容都调用所有工具（全面，成本高）
   - [ ] 根据内容类型选择性调用（推荐）
   - [ ] 仅调用 `check_duplicate`（保守）

4. **实施优先级**？
   - [ ] 立即开始（本周完成）
   - [ ] 下周开始（留出缓冲）
   - [ ] 暂缓，先做其他优化

---

**审阅人**: ___________
**审阅日期**: ___________
**批准状态**: [ ] 批准 [ ] 需修改 [ ] 拒绝
