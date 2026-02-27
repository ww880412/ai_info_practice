# AI Practice Hub 架构深度评审报告

> 评审日期：2026-02-27
> 评审范围：代码架构 + 框架替代可行性

## 1. 项目概览

### 1.1 规模指标

| 指标 | 数值 |
|------|------|
| 代码规模 | ~23,357 行 TypeScript/TSX |
| Prisma Schema | 414 行，16 个模型 |
| API 路由 | 12 个目录，~24 个端点 |
| 组件目录 | 7 个（agent, common, entry, ingest, library, practice, ui） |
| 自定义 Hooks | 6 个 |
| Parser 策略 | 9 种（github, webpage, pdf, image, markdown, youtube...） |
| 测试用例 | 56 个 |

### 1.2 技术栈

- **前端**: Next.js 16, React 19, Tailwind CSS v4, TanStack React Query
- **后端**: Next.js App Router API Routes
- **数据库**: PostgreSQL 15 + Prisma 5.22.0
- **AI**: Google Gemini API（手写封装）
- **部署**: Docker + docker-compose

### 1.3 核心手写模块

| 模块 | 行数 | 职责 |
|------|------|------|
| `lib/ai/agent/engine.ts` | 544 | ReAct Agent 引擎，两步推理 |
| `lib/gemini.ts` | 246 | Gemini API 封装 |
| `lib/ingest/queue.ts` | 174 | 内存任务队列 |
| `lib/parser/*` | ~400 | URL/PDF/图片解析 |
| `lib/ai/deduplication.ts` | 72 | Jaccard 相似度去重 |
| **总计** | ~1,436 | — |

---

## 2. 架构级问题（P0）

### 2.1 Entry 模型 God Object

**位置**: `prisma/schema.prisma` Entry 模型

**问题描述**：
`Entry` 模型承载了 **35+ 字段**，混合了多个职责域：

```prisma
model Entry {
  // 原始输入（5 字段）
  inputType, rawUrl, rawText, sourceType, originalContent

  // 处理状态（4 字段）
  processStatus, processError, knowledgeStatus, reviewedAt

  // AI 分类结果（4 字段）
  contentType, techDomain, aiTags, userTags

  // AI 提取结果（6 字段）
  coreSummary, keyPoints, summaryStructure, keyPointsNew, boundaries, confidence

  // 评估维度（4 字段）
  difficulty, contentForm, timeliness, sourceTrust

  // 智能摘要（4 字段）
  smartSummary, keyInsights, tldr, qualityOverride

  // 关联（8 个关系）
  practiceTask, parseLogs, reasoningTraces, qualityHistories, ...
}
```

**风险**：
- 单次查询返回大量冗余数据（网络/内存开销）
- 字段膨胀导致迁移复杂度高
- 难以独立演进各子域
- 违反单一职责原则

**现状**：
B2.1 已拆分出 `EntryAIResult`、`EntryEvaluation`、`EntrySmartSummary`，但 Entry 主表仍保留所有旧字段（双写模式），迁移未完成。

**建议**：
1. 制定字段废弃时间表（建议 2 个迭代周期）
2. 查询层优先使用拆分后的关联表
3. 新代码禁止直接访问 Entry 上的冗余字段

---

### 2.2 遗留代码与新架构共存

**位置**: `src/app/api/ingest/route.ts`

**问题描述**：
ingest 路由同时依赖两套处理架构：

```typescript
// 新架构
import { ReActAgent } from "@/lib/ai/agent";
import { normalizeAgentIngestDecision } from "@/lib/ai/agent/ingest-contract";

// 遗留架构
import { classifyAndExtract } from "@/lib/ai/classifier";
import { convertToPractice } from "@/lib/ai/practiceConverter";

// 运行时切换
if (shouldAllowLegacyClassifierFallback()) {
  // 使用遗留 classifier
}
```

**风险**：
- 两套处理路径增加测试复杂度
- 降级逻辑散落在多处，难以追踪
- classifier.ts (53行) + practiceConverter.ts (67行) 已标注"遗留"但无废弃计划

**建议**：
1. 添加 fallback 触发频率监控
2. 设置废弃时间线（建议 1 个月后移除）
3. 在移除前，将 fallback 触发作为告警指标

---

### 2.3 JSON 字段类型安全缺口

**位置**: `prisma/schema.prisma` 多个 Json 字段

**问题描述**：
```prisma
summaryStructure Json?   // { type, fields, reasoning }
keyPointsNew    Json?   // { core: [], extended: [] }
boundaries      Json?   // { applicable: [], notApplicable: [] }
extractedMetadata Json?
```

多个 `Json` 字段在数据库层无 schema 约束。虽然 B3 已添加 Zod 验证（`SummaryStructureSchema` 等），但：
- 写入时验证覆盖不完整（部分路径未使用 Zod）
- 旧数据可能不符合新 schema
- 读取时缺乏统一反序列化层

**建议**：
1. 封装 `safeParseJson<T>(data, schema)` 统一处理
2. 添加数据库迁移脚本验证/修复历史数据
3. 所有 JSON 字段读写必须经过 Zod schema

---

## 3. 设计隐患（P1）

### 3.1 API 层缺乏统一抽象

**问题描述**：
API 路由分散在 12 个目录，各自实现：
- 错误处理逻辑重复
- 响应格式不完全一致（部分返回 `{ data }` 部分返回裸对象）
- 缺乏中间件层（日志、认证预留、限流）

**建议**：
```typescript
// 统一 API handler wrapper
const apiHandler = <T>(handler: Handler<T>) => async (req: NextRequest) => {
  const startTime = Date.now();
  try {
    const result = await handler(req);
    return NextResponse.json({ data: result }, {
      headers: { 'X-Response-Time': `${Date.now() - startTime}ms` }
    });
  } catch (e) {
    console.error('[API Error]', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
};
```

---

### 3.2 前端状态管理边界模糊

**位置**: `src/hooks/useEntries.ts`

**问题描述**：
```typescript
sort?: "createdAt" | "updatedAt" | "confidence" | "practiceValue" | "difficulty" | "smart";
sortBy?: "createdAt" | "updatedAt" | "title";
sortOrder?: "asc" | "desc";
```

- `sort` 和 `sortBy` 两个参数功能重叠
- 参数在 URL、Hook、API 三层传递，类型定义分散
- 缺乏统一的 query params schema

**建议**：
1. 统一为 `sortBy` + `sortOrder` 模式
2. 使用 Zod 定义共享的 `QueryParams` schema
3. URL ↔ Hook ↔ API 使用同一类型定义

---

## 4. 可优化项（P2）

### 4.1 组件目录扁平化不足

```
src/components/
├── agent/          # 1 个组件
├── common/         # 多个通用组件
├── entry/          # 15+ 个组件（过载）
├── ingest/         # 入库相关
├── library/        # 知识库相关
├── practice/       # 练习相关
└── ui/             # shadcn-like 基础组件
```

`entry/` 目录承载过多组件，建议按功能子域拆分：
```
entry/
├── detail/         # 详情页相关
├── edit/           # 编辑相关
└── summary/        # 摘要展示相关
```

---

### 4.2 Parser 策略注册模式

当前 parser 通过硬编码注册，新增 parser 需要修改多处：
1. 创建 parser 文件
2. 修改 registry.ts
3. 修改 index.ts

**建议**：采用插件式自注册模式。

---

### 4.3 测试覆盖结构化不足

| 模块 | 测试数 | 评估 |
|------|--------|------|
| parser | 8 | ✅ 充足 |
| ai/agent | 15 | ✅ 充足 |
| gemini | 5 | ⚠️ 一般 |
| ingest | 7 | ⚠️ 一般 |
| **entries** | **2** | ❌ 不足 |
| sanitize | 10 | ✅ 充足 |
| deduplication | 7 | ✅ 充足 |

- entries 测试仅 2 个，覆盖不足
- 缺乏 API 路由的集成测试
- E2E 测试刚建立（26 个 smoke tests）

---

### 4.4 缺乏性能监控基础设施

- 无 API 响应时间追踪
- 无数据库查询性能监控
- AI 处理耗时仅在 trace 中记录，无聚合分析

**建议**：添加 OpenTelemetry 或轻量级 metrics 收集。

---

## 5. 框架替代分析

### 5.1 LLM 调用层 → Vercel AI SDK

| 维度 | 现状 | 替代后 |
|------|------|--------|
| 代码量 | 246 行 | ~20 行 |
| 模型切换 | 全部重写 | 改一行配置 |
| 结构化输出 | 手写正则解析 | Zod schema 强制 |
| Streaming | 不支持 | 原生支持 |
| Retry/Rate Limit | 手写 | 内置 |

**推荐框架**: [Vercel AI SDK](https://sdk.vercel.ai/) (`ai` + `@ai-sdk/google`)

```typescript
// 替代后示例
import { generateObject } from 'ai';
import { google } from '@ai-sdk/google';

const { object } = await generateObject({
  model: google('gemini-2.0-flash'),
  schema: Step1Schema,
  prompt: buildStep1Prompt(input),
});
```

---

### 5.2 Agent 引擎 → Vercel AI SDK generateObject

| 维度 | 现状 | 替代后 |
|------|------|--------|
| 代码量 | 544 行 | ~100 行 |
| 输出解析 | 正则匹配，易出错 | Schema 强制，100% 可靠 |
| Tool Calling | 手写 | 原生支持 |

当前 `parseAgentResponse` 使用大量正则提取 THINK/ACTION/FINAL 等字段，容易因格式变化而失败。

---

### 5.3 任务队列 → Inngest

| 维度 | 现状 | 替代后 |
|------|------|--------|
| 代码量 | 174 行 | ~30 行 |
| 持久化 | ❌ 内存级 | ✅ 持久化 |
| 可视化 | ❌ 无 | ✅ Dashboard |
| Retry | 手写 | 内置 |
| 进程重启 | 任务丢失 | 自动恢复 |

**推荐框架**: [Inngest](https://inngest.com/)（Next.js 原生支持，免费额度充足）

```typescript
// 替代后示例
import { inngest } from './client';

export const processEntry = inngest.createFunction(
  { id: 'process-entry', retries: 3 },
  { event: 'entry/ingest' },
  async ({ event, step }) => {
    await step.run('parse', () => parseContent(event.data.entryId));
    await step.run('ai-process', () => runAgent(event.data.entryId));
  }
);
```

---

### 5.4 网页解析 → Jina Reader / Firecrawl

| 维度 | 现状 | 替代后 |
|------|------|--------|
| 代码量 | ~200 行 | ~10 行 |
| JS 渲染页面 | ❌ 不支持 | ✅ 支持 |
| 反爬处理 | ❌ 无 | ✅ 自动 |

**推荐框架**:
- 免费方案: [Jina Reader](https://jina.ai/reader/) (`https://r.jina.ai/{url}`)
- 付费方案: [Firecrawl](https://firecrawl.dev/)（功能更全）

---

### 5.5 去重检测 → pgvector

| 维度 | 现状 | 替代后 |
|------|------|--------|
| 算法 | Jaccard（词袋） | 向量语义 |
| 精度 | 低（词重叠） | 高（语义理解） |
| 可扩展性 | O(n) 全表扫描 | O(log n) 向量索引 |

**推荐方案**: pgvector + Embedding（PostgreSQL 原生扩展，无需额外服务）

---

## 6. 架构亮点

1. **ReAct Agent 设计**：两步推理（classify → extract）+ 置信度评估 + 决策修复，架构清晰
2. **类型契约**：`ingest-contract.ts` + Zod schemas 确保 AI 输出结构化
3. **可观测性**：`ReasoningTrace` + `ParseLog` + `ProcessAttempt` 完整追踪处理链路
4. **渐进式升级**：Batch 1-3 系统性升级路径清晰，双写模式保证兼容
5. **测试基础**：56 个单元测试 + 26 个 E2E smoke tests

---

## 7. 问题优先级汇总

| 优先级 | 问题 | 类型 | 建议行动 |
|--------|------|------|----------|
| **P0** | Entry God Object | 架构 | 制定字段迁移时间表 |
| **P0** | 遗留代码废弃 | 技术债 | 设置废弃日期 + 监控 |
| **P0** | JSON 字段校验 | 质量 | 迁移脚本 + 统一处理 |
| **P0** | gemini.ts 手写 | 框架替代 | Vercel AI SDK |
| **P0** | agent/engine.ts 解析 | 框架替代 | generateObject |
| **P0** | ingest/queue.ts 内存队列 | 框架替代 | Inngest |
| **P1** | API 层抽象缺失 | 设计 | 实现 handler wrapper |
| **P1** | 前端参数重复 | 设计 | 清理 sort 参数 |
| **P1** | 网页解析手写 | 框架替代 | Jina Reader |
| **P1** | 去重精度低 | 框架替代 | pgvector |
| **P2** | 组件目录过载 | 代码组织 | 拆分 entry/ |
| **P2** | Parser 非插件化 | 可扩展性 | 自注册模式 |
| **P2** | 测试覆盖不足 | 质量 | 补充 API 集成测试 |
| **P2** | 性能监控缺失 | 可观测性 | OpenTelemetry |

---

## 8. 附录

### 8.1 关键文件清单

| 文件 | 行数 | 职责 |
|------|------|------|
| `prisma/schema.prisma` | 414 | 数据模型定义 |
| `src/lib/ai/agent/engine.ts` | 544 | ReAct Agent 核心 |
| `src/lib/gemini.ts` | 246 | Gemini API 封装 |
| `src/lib/ingest/queue.ts` | 174 | 任务队列 |
| `src/app/api/ingest/route.ts` | ~350 | 入库 API |
| `src/app/entry/[id]/page.tsx` | ~400 | 条目详情页 |

### 8.2 依赖版本

```json
{
  "@google/generative-ai": "^0.24.1",
  "@prisma/client": "5.22.0",
  "@tanstack/react-query": "^5.90.21",
  "next": "16.1.6",
  "react": "19.2.3",
  "zod": "^4.3.6"
}
```

---

*报告生成时间: 2026-02-27*
