# ReAct Agent Phase 2a 实施方案（v1.4）

**版本**: v1.4  
**日期**: 2026-03-02  
**状态**: 修正后可实施（基于第二轮评审问题闭环）  
**目标**: 解决 v1.3 中的枚举漂移、trace 字段名错误、feature flag 空切换、迁移脚本字段缺失、函数签名不匹配、practiceTask 字段漂移。

---

## 1. 代码核对结论（真实文件）

### 1.1 Prisma 枚举（Blocking B1）
来源：`prisma/schema.prisma`

- `ContentType`: `TUTORIAL` | `TOOL_RECOMMENDATION` | `TECH_PRINCIPLE` | `CASE_STUDY` | `OPINION`
- `TechDomain`: `PROMPT_ENGINEERING` | `AGENT` | `RAG` | `FINE_TUNING` | `DEPLOYMENT` | `OTHER`
- `PracticeValue`: `KNOWLEDGE` | `ACTIONABLE`

结论：v1.3 文档里的 `ARTICLE/DOCUMENTATION/...`、`LLM/PROMPT/...`、`REFERENCE/ARCHIVE` 均与 Prisma 不一致，必须替换。

### 1.2 AI SDK trace 字段名（Blocking B3）
来源：`node_modules/ai/dist/index.d.ts`（`ai@6.0.105`）

- `TypedToolCall`: `toolName`, `toolCallId`, `input`
- `TypedToolResult`: `toolName`, `toolCallId`, `input`, `output`

结论：v1.3 中 `toolResult.result` 是错误字段，必须改为 `toolResult.output`。

### 1.3 Feature flag 读取（High H2）
来源：`src/lib/ai/agent/get-config.ts`

当前逻辑：DB 有默认配置时直接返回 `saved.config`，会覆盖/吞掉环境变量开关。  
结论：`useToolCalling` 必须在 `get-config.ts` 返回前强制由环境变量注入，不能被 DB 配置覆盖。

### 1.4 AgentConfig 模型（High H3）
来源：`prisma/schema.prisma`

`model AgentConfig` 含必需字段：`name String @unique`。  
结论：迁移脚本 `create` 必须写 `name`，建议用 `where: { name: 'default' }` upsert。

### 1.5 generate.ts / route-strategy.ts 真实签名（新增）
来源：`src/lib/ai/generate.ts`、`src/lib/ai/agent/route-strategy.ts`

- `generateJSON<T>(prompt: string, schema?: z.ZodSchema<T>): Promise<T>`
- `generateText(prompt: string): Promise<string>`（注意：本地封装仅支持字符串 prompt）
- `generateFromFile<T>(prompt: string, fileData, schema?)`
- `route-strategy.ts` 导出函数名是 `selectToolPipeline(contentType: string): string[]`

结论：若要用 AI SDK 原生 `generateText({ tools, stopWhen, output })`，必须直接 `import { generateText } from 'ai'`，不能调用本地封装 `generateText(prompt: string)`。  
结论：文档中的 `selectStrategy(...)` 为不存在函数，改为 `selectToolPipeline(...)`。

### 1.6 practiceTask 字段（Medium）
来源：`src/lib/ai/agent/ingest-contract.ts` -> `normalizePracticeTask`

期望字段：
- `title`
- `summary`（不是 `description`）
- `difficulty`
- `estimatedTime`（不是 `estimatedMinutes`）
- `prerequisites`
- `steps[]`（`order/title/description`）

结论：DecisionSchema 和 Prompt 输出必须按以上字段命名，否则标准化后会丢值或退化。

---

## 2. v1.4 修正方案（完整）

## 2.1 DecisionSchema（与 Prisma 完全对齐）

```typescript
import { z } from "zod";

export const DecisionSchema = z.object({
  contentType: z.enum([
    "TUTORIAL",
    "TOOL_RECOMMENDATION",
    "TECH_PRINCIPLE",
    "CASE_STUDY",
    "OPINION",
  ]),
  techDomain: z.enum([
    "PROMPT_ENGINEERING",
    "AGENT",
    "RAG",
    "FINE_TUNING",
    "DEPLOYMENT",
    "OTHER",
  ]),
  aiTags: z.array(z.string()),
  coreSummary: z.string().min(1),
  keyPoints: z.object({
    core: z.array(z.string()),
    extended: z.array(z.string()).optional(),
  }),
  summaryStructure: z.object({
    type: z.enum([
      "problem-solution-steps",
      "concept-mechanism-flow",
      "tool-feature-comparison",
      "background-result-insight",
      "argument-evidence-condition",
      "generic",
      "api-reference",
      "comparison-matrix",
      "timeline-evolution",
    ]),
    reasoning: z.string().optional(),
    fields: z.record(z.string(), z.unknown()),
  }),
  boundaries: z.object({
    applicable: z.array(z.string()),
    notApplicable: z.array(z.string()).optional(),
  }),
  confidence: z.number().min(0).max(1).optional(),

  difficulty: z.enum(["EASY", "MEDIUM", "HARD"]).nullable().optional(),
  sourceTrust: z.enum(["HIGH", "MEDIUM", "LOW"]).nullable().optional(),
  timeliness: z.enum(["RECENT", "OUTDATED", "CLASSIC"]).nullable().optional(),
  contentForm: z
    .enum(["TEXTUAL", "CODE_HEAVY", "VISUAL", "MULTIMODAL"])
    .nullable()
    .optional(),

  practiceValue: z.enum(["KNOWLEDGE", "ACTIONABLE"]),
  practiceReason: z.string(),
  practiceTask: z
    .object({
      title: z.string(),
      summary: z.string(),
      difficulty: z.enum(["EASY", "MEDIUM", "HARD"]),
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
```

---

## 2.2 Trace 映射修正（AI SDK 正确字段）

```typescript
import type { GenerateTextResult, Output, ToolSet } from "ai";

// 注意：TypedToolCall/TypedToolResult 是 AI SDK 内部类型，不直接导出
// 使用 step.toolCalls/toolResults 的推断类型即可

function buildReasoningTrace<TOOLS extends ToolSet, OUT extends Output>(
  result: GenerateTextResult<TOOLS, OUT>
) {
  const steps = result.steps.map((step, index) => {
    // 直接使用推断类型，无需显式 cast
    const toolCalls = step.toolCalls ?? [];
    const toolResults = step.toolResults ?? [];

    const observation = toolResults.map((tr) => ({
      toolCallId: tr.toolCallId,
      toolName: tr.toolName,
      input: tr.input,
      output: tr.output, // v1.4 修正点：不是 result
    }));

    return {
      step: index + 1,
      timestamp: new Date().toISOString(),
      thought: step.text || "",
      action: toolCalls[0]?.toolName || "reasoning",
      observation: JSON.stringify(observation),
      reasoning: step.reasoningText || step.text || "",
      context: {
        stepType: toolCalls.length > 0 ? "tool_call" : "reasoning",
        toolCallCount: toolCalls.length,
      },
    };
  });

  return {
    steps,
    finalResult: result.output,
  };
}
```

---

## 2.3 Feature Flag 修正（H2）

要求：`useToolCalling` 始终由环境变量控制，不被 DB 覆盖。

### 修改点 A：`src/lib/ai/agent/types.ts`
```typescript
export interface AgentConfig {
  evaluationDimensions: EvaluationDimension[];
  processingStrategies: ProcessingStrategy[];
  availableTools: string[];
  maxIterations: number;
  useToolCalling: boolean;
}
```

### 修改点 B：`src/lib/ai/agent/config.ts`
```typescript
function readUseToolCallingFromEnv(): boolean {
  return process.env.REACT_AGENT_USE_TOOLS === "true";
}

export function getDefaultConfig(): AgentConfig {
  return {
    evaluationDimensions: DEFAULT_EVALUATION_DIMENSIONS,
    processingStrategies: DEFAULT_PROCESSING_STRATEGIES,
    availableTools: [
      "evaluate_dimension",
      "classify_content",
      "extract_summary",
      "extract_code",
      "extract_version",
      "check_duplicate",
      "route_to_strategy",
    ],
    maxIterations: 10,
    useToolCalling: readUseToolCallingFromEnv(),
  };
}
```

### 修改点 C：`src/lib/ai/agent/get-config.ts`
```typescript
import { prisma } from "@/lib/prisma";
import { getDefaultConfig } from "./config";
import type { AgentConfig } from "./types";

function readUseToolCallingFromEnv(): boolean {
  return process.env.REACT_AGENT_USE_TOOLS === "true";
}

export async function getAgentConfig(): Promise<AgentConfig> {
  const base = getDefaultConfig();
  const saved = await prisma.agentConfig.findFirst({
    where: { isDefault: true },
  });

  const dbConfig = saved?.config as Partial<AgentConfig> | undefined;

  return {
    ...base,
    ...(dbConfig ?? {}),
    useToolCalling: readUseToolCallingFromEnv(), // 强制 env 优先
  };
}
```

---

## 2.4 迁移脚本修正（H3）

### `scripts/migrate-agent-config.ts`（修正版）
```typescript
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getDefaultConfig } from "@/lib/ai/agent/config";

async function main() {
  const defaultConfig = getDefaultConfig();

  await prisma.agentConfig.upsert({
    where: { name: "default" }, // 使用唯一字段 name
    update: {
      config: defaultConfig as Prisma.InputJsonValue,
      isDefault: true,
    },
    create: {
      name: "default", // v1.4 修正点：必须包含 name
      config: defaultConfig as Prisma.InputJsonValue,
      isDefault: true,
    },
  });

  await prisma.agentConfig.updateMany({
    where: { name: { not: "default" }, isDefault: true },
    data: { isDefault: false },
  });
}

main()
  .then(() => {
    console.log("agent config migrated");
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

---

## 2.5 函数签名修正（新增问题）

### generate.ts
- 本地封装 `generateText(prompt: string)` 不支持对象参数。
- 因此 Phase 2a 工具调用路径必须：
  - 直接使用 `import { generateText, Output, stepCountIs, tool } from "ai"`；
  - 不要调用 `src/lib/ai/generate.ts` 里的 `generateText(prompt: string)`。

### route-strategy.ts
- 真实导出函数：`selectToolPipeline(contentType: string): string[]`
- 不存在：`selectStrategy(...)`
- 修正调用：
```typescript
import { selectToolPipeline } from "./route-strategy";
const pipeline = selectToolPipeline(contentType);
```

---

## 2.6 practiceTask 字段修正（Medium）

Prompt 输出与 Schema 必须统一为：

```json
{
  "practiceTask": {
    "title": "...",
    "summary": "...",
    "difficulty": "EASY|MEDIUM|HARD",
    "estimatedTime": "30-60 min",
    "prerequisites": ["..."],
    "steps": [
      { "order": 1, "title": "...", "description": "..." }
    ]
  }
}
```

禁止再使用：
- `practiceTask.description`（应为 `summary`）
- `practiceTask.estimatedMinutes`（应为 `estimatedTime`）

---

## 3. 实施步骤（v1.4）

1. 更新 `AgentConfig` 类型与默认配置，加入 `useToolCalling`。  
2. 改 `get-config.ts`：DB 合并后强制覆盖 `useToolCalling=env`。  
3. 修正 DecisionSchema 枚举与 practiceTask 字段。  
4. 在工具调用分支使用 AI SDK 原生 `generateText({ ... })`，不走本地 `generate.ts` 文本封装。  
5. 修正 trace 映射字段：`toolCall.input` + `toolResult.output`。  
6. 新增/修正 `scripts/migrate-agent-config.ts`，确保 `name` 字段存在并可幂等执行。  

---

## 4. 验收标准（v1.4）

- [ ] DecisionSchema 枚举与 `prisma/schema.prisma` 完全一致。  
- [ ] trace 结构中不再出现 `result`/`args` 旧字段，全部使用 AI SDK 正确字段。  
- [ ] `getAgentConfig()` 在 DB 存在默认配置时，`useToolCalling` 仍由环境变量决定。  
- [ ] 迁移脚本可执行且不会因缺少 `name` 失败。  
- [ ] 所有调用使用真实存在函数与真实签名（`generate.ts`、`route-strategy.ts` 已核对）。  
- [ ] `practiceTask` 字段在 normalize 后不丢失。  

---

## 5. 风险与回退

- 风险：AI SDK 工具链路引入后，模型可能不触发工具调用。  
  - 缓解：`stopWhen: stepCountIs(config.maxIterations)` + 明确 `toolChoice` 策略 + trace 监控。
- 风险：DB 历史配置与新字段不兼容。  
  - 缓解：读配置时做 `Partial<AgentConfig>` 合并，不直接信任 DB 全量结构。
- 回退：将 `REACT_AGENT_USE_TOOLS=false`，流程退回非工具路径，不依赖 DB 开关。

---

## 6. Claude 评审补充说明（v1.4.1）

### 6.1 类型导入修正

`TypedToolCall` 和 `TypedToolResult` 是 AI SDK 内部类型，不直接从 `ai` 包导出。

**解决方案**：使用 `step.toolCalls` 和 `step.toolResults` 的推断类型，无需显式 cast。已在 2.2 节更新代码。

### 6.2 keyPoints 结构兼容性确认

v1.4 使用 `keyPoints: { core, extended }` 对象结构，这与 `normalizeKeyPoints()` 函数完全兼容：

```typescript
// ingest-contract.ts:585-598
function normalizeKeyPoints(value: unknown, coreSummary: string) {
  const record = toObject(value);
  if (record) {
    const core = normalizeStringList(record.core);
    const extended = normalizeStringList(record.extended);
    // ... 支持 { core, extended } 结构
  }
  // 也支持 legacy 数组格式
}
```

**结论**：v1.4 的 `keyPoints` schema 与标准化函数兼容，无需修改。

### 6.3 实施建议

1. **分步实施**：先实现 Feature flag + 配置修改，验证通过后再实现工具迁移
2. **Mock 测试**：工具执行路径涉及真实模型调用，测试时需 mock `generateJSON`
3. **监控指标**：上线后关注工具调用成功率和 P95 处理时延

---

**评审状态**: ✅ 通过
**评审人**: Claude
**评审日期**: 2026-03-02
