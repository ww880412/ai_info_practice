# AI Practice Hub 框架重构计划

> 基于 2026-02-27 架构评审，制定框架替代与代码精简路线图

## 1. 重构目标

### 1.1 核心目标

| 目标 | 量化指标 |
|------|----------|
| 代码精简 | 手写核心代码从 ~1,193 行降至 ~519 行（-56.5%） |
| 框架统一 | LLM 调用统一到 Vercel AI SDK |
| 可靠性提升 | 任务队列从内存级升级为持久化 |
| 维护成本降低 | 从「自己维护」转为「社区维护」 |

### 1.2 非目标（本次不做）

- 数据模型大重构（Entry 拆分需要更长周期）
- UI/UX 重设计
- 国际化

---

## 2. 技术选型

### 2.1 确定采用

| 领域 | 选型 | 理由 |
|------|------|------|
| LLM 调用 | **Vercel AI SDK** (`ai` + `@ai-sdk/google`) | Next.js 官方推荐，TypeScript 原生，Zod 集成 |
| 任务队列 | **Inngest** | 无需 Redis，Next.js 原生支持，免费额度充足 |
| 网页解析 | **Jina Reader** | 免费，支持 JS 渲染，API 简单 |

### 2.2 待评估（Phase 2 决策）

| 领域 | 候选 | 决策条件 |
|------|------|----------|
| 向量检索 | pgvector vs Pinecone | 数据量 <100K 用 pgvector，否则考虑 Pinecone |
| PDF 解析 | 保持现状 vs Unstructured | 当前 pdf-parse 够用，复杂 PDF 再升级 |

---

## 3. 分阶段实施

### Phase 0: 对象存储迁移（预计 1 天｜实际任务 6.5h）

**⚠️ 关键前置条件**：必须在 Phase 2 (Inngest) 之前完成

#### 3.0.1 目标

- 将文件上传从本地 `public/uploads` 迁移到对象存储（S3/R2/Cloudflare R2）
- 修改 parser 从对象存储 URL 读取文件
- 确保分布式队列环境下文件可访问

#### 3.0.2 实施步骤

| 步骤 | 任务 | 交付物 | 估时 |
|------|------|--------|------|
| 0.1 | 选择对象存储方案（建议 Cloudflare R2） | 技术选型文档 | 0.5h |
| 0.2 | 配置对象存储 SDK + 环境变量 | 上传/下载工具函数 | 1h |
| 0.3 | 修改 `/api/upload` 路由 | 上传到对象存储 | 1h |
| 0.4 | 修改 parser (pdf.ts, image-multimodal.ts) | 从 URL 读取文件 | 2h |
| 0.5 | 数据迁移脚本 | 迁移现有文件到对象存储 | 1h |
| 0.6 | 测试 + 验证 | 所有上传/解析功能正常 | 1h |

---

### Phase 1: Vercel AI SDK 统一（预计 3 天｜实际任务 12h）

#### 3.1.1 目标

- 创建 `lib/ai/client.ts` 统一 AI SDK 配置
- 迁移所有 gemini.ts 依赖（13 个文件）
- 删除 `lib/gemini.ts` (246 行)
- 重写 `lib/ai/agent/engine.ts` 核心部分 (~400 行)
- 删除 `lib/ai/classifier.ts` + `lib/ai/practiceConverter.ts` (120 行)

#### 3.1.2 新增依赖

```bash
npm install ai@^4.0.0 @ai-sdk/google@^1.0.0
```

**验证版本**（2026-02-28）:
- `ai`: ^4.0.0
- `@ai-sdk/google`: ^1.0.0
- 兼容 Next.js 16.x + React 19.x + Zod 4.x

#### 3.1.3 实施步骤

| 步骤 | 任务 | 交付物 | 估时 |
|------|------|--------|------|
| 1.1 | 创建 `lib/ai/client.ts` | AI SDK 统一配置 | 0.5h |
| 1.2 | 迁移 agent 模块 (4个文件) | engine.ts, builtin-tools.ts, route-strategy.ts, decision-repair.ts | 3h |
| 1.3 | 迁移 parser 模块 (2个文件) | pdf.ts, image-multimodal.ts | 1h |
| 1.4 | 迁移 AI 功能模块 (3个文件) | smartSummary.ts, associationDiscovery.ts, classifier.ts | 2h |
| 1.5 | 迁移 API 路由 (2个文件) | ingest/route.ts, config/validate/route.ts | 1h |
| 1.6 | 删除 gemini.ts + practiceConverter.ts | 移除遗留代码 | 0.5h |
| 1.7 | 更新所有测试 | gemini.test.ts 等 | 2h |
| 1.8 | 运行测试 + 修复 | 全部测试通过 | 2h |

#### 3.1.4 代码示例

**Before** (`lib/gemini.ts`):
```typescript
let genAI: GoogleGenerativeAI | null = null;
let currentModel: string = "";
let currentApiKey: string = "";

function getGenAI(): GoogleGenerativeAI {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("Gemini API key is not configured");
  // ... 50+ 行状态管理
}

export async function generateJSON<T>(prompt: string): Promise<T> {
  const model = getGeminiModel();
  const result = await model.generateContent(...);
  // ... 解析逻辑
}
```

**After** (`lib/ai/client.ts`):
```typescript
import { createGoogleGenerativeAI } from '@ai-sdk/google';

export function getAIClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not configured");
  return createGoogleGenerativeAI({ apiKey });
}

export function getModel() {
  const google = getAIClient();
  return google(process.env.GEMINI_MODEL || 'gemini-2.0-flash');
}
```

**Before** (`lib/ai/agent/engine.ts`):
```typescript
private async runStep1(input: ParseResult): Promise<Record<string, unknown>> {
  const prompt = this.buildStep1Prompt(input);
  return this.generateStructuredObject(prompt, "step-1");
}

private async generateStructuredObject(prompt: string, stage: string) {
  try {
    const json = await generateJSON<Record<string, unknown>>(prompt);
    const normalized = toObject(json);  // 手写解析
    if (!normalized) throw new Error(...);
    return normalized;
  } catch (primaryError) {
    // fallback 逻辑...
  }
}
```

**After** (`lib/ai/agent/engine.ts`):
```typescript
import { generateObject } from 'ai';
import { getModel } from '../client';
import { Step1Schema, Step2Schema } from './schemas';

private async runStep1(input: ParseResult) {
  const { object } = await generateObject({
    model: getModel(),
    schema: Step1Schema,
    prompt: this.buildStep1Prompt(input),
  });
  return object;
}
```

#### 3.1.5 验收标准

- [ ] `npm run test` 全部通过
- [ ] `npm run build` 无错误
- [ ] 手动测试：入库一个 URL，AI 处理成功
- [ ] 删除文件列表：
  - `src/lib/gemini.ts`
  - `src/lib/ai/classifier.ts`
  - `src/lib/ai/practiceConverter.ts`

---

### Phase 2: Inngest 任务队列（预计 1.5 天｜实际任务 5.5h）

**⚠️ 前置条件**：Phase 0 (对象存储迁移) 必须完成

#### 3.2.1 目标

- 删除 `lib/ingest/queue.ts` (174 行)
- **保留** `lib/ingest/retry.ts` (109 行，被 ai/process 路由使用)
- 任务持久化，进程重启不丢失
- 可视化 dashboard 监控

#### 3.2.2 新增依赖

```bash
npm install inngest@^3.0.0
```

**验证版本**（2026-02-28）:
- `inngest`: ^3.0.0
- 兼容 Next.js 16.x

#### 3.2.3 实施步骤

| 步骤 | 任务 | 交付物 | 估时 |
|------|------|--------|------|
| 2.1 | 创建 `lib/inngest/client.ts` | Inngest 客户端配置 | 0.5h |
| 2.2 | 创建 `lib/inngest/functions/process-entry.ts` | 入库处理函数 | 1.5h |
| 2.3 | 创建 `app/api/inngest/route.ts` | Inngest webhook | 0.5h |
| 2.4 | 重写 `app/api/ingest/route.ts` | 使用 inngest.send() | 1h |
| 2.5 | 删除 `lib/ingest/queue.ts` | 清理队列代码 | 0.5h |
| 2.6 | 配置 Inngest Dev Server | 本地开发环境 | 0.5h |
| 2.7 | 运行测试 + 修复 | 全部测试通过 | 1h |

#### 3.2.4 代码示例

**`lib/inngest/client.ts`**:
```typescript
import { Inngest } from 'inngest';

export const inngest = new Inngest({
  id: 'ai-practice-hub',
  schemas: new EventSchemas().fromRecord<{
    'entry/ingest': { data: { entryId: string; config?: IngestConfig } };
    'entry/reprocess': { data: { entryId: string } };
  }>(),
});
```

**`lib/inngest/functions/process-entry.ts`**:
```typescript
import { inngest } from '../client';
import { prisma } from '@/lib/prisma';
import { ReActAgent } from '@/lib/ai/agent';

export const processEntry = inngest.createFunction(
  {
    id: 'process-entry',
    retries: 3,
    onFailure: async ({ event, error }) => {
      await prisma.entry.update({
        where: { id: event.data.entryId },
        data: { processStatus: 'FAILED', processError: error.message },
      });
    },
  },
  { event: 'entry/ingest' },
  async ({ event, step }) => {
    const { entryId, config } = event.data;

    // Step 1: Parse content
    const parsed = await step.run('parse', async () => {
      const entry = await prisma.entry.findUnique({ where: { id: entryId } });
      if (!entry) throw new Error('Entry not found');
      return parseContent(entry);
    });

    // Step 2: AI process
    const result = await step.run('ai-process', async () => {
      const agent = new ReActAgent(await getAgentConfig());
      return agent.process(entryId, parsed);
    });

    // Step 3: Save result
    await step.run('save', async () => {
      await saveAgentResult(entryId, result);
    });

    return { success: true, entryId };
  }
);
```

**`app/api/inngest/route.ts`**:
```typescript
import { serve } from 'inngest/next';
import { inngest } from '@/lib/inngest/client';
import { processEntry } from '@/lib/inngest/functions/process-entry';

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [processEntry],
});
```

**重写后的 `app/api/ingest/route.ts`**:
```typescript
import { inngest } from '@/lib/inngest/client';

export async function POST(req: NextRequest) {
  // ... 创建 entry 逻辑不变

  const entry = await prisma.entry.create({ data: { ... } });

  // 触发异步处理
  await inngest.send({
    name: 'entry/ingest',
    data: { entryId: entry.id, config: { geminiApiKey, geminiModel } },
  });

  return NextResponse.json({ data: { id: entry.id } });
}
```

#### 3.2.5 验收标准

- [ ] Inngest Dev Server 启动正常
- [ ] 入库任务在 Inngest Dashboard 可见
- [ ] 进程重启后，pending 任务自动恢复
- [ ] 删除文件列表：
  - `src/lib/ingest/queue.ts`

---

### Phase 3: Jina Reader 网页解析（预计 0.5 天｜实际任务 2h）

#### 3.3.1 目标

- 简化 `lib/parser/webpage.ts`
- 支持 JS 渲染页面（当前不支持）

#### 3.3.2 实施步骤

| 步骤 | 任务 | 交付物 | 估时 |
|------|------|--------|------|
| 3.1 | 创建 `lib/parser/jina.ts` | Jina Reader 封装 | 0.5h |
| 3.2 | 修改 `lib/parser/webpage.ts` | 优先使用 Jina，fallback 到 cheerio | 1h |
| 3.3 | 更新测试 | 验证两种路径 | 0.5h |

#### 3.3.3 代码示例

**`lib/parser/jina.ts`**:
```typescript
export async function parseWithJina(url: string): Promise<{
  title: string;
  content: string;
  success: boolean;
}> {
  try {
    const response = await fetch(`https://r.jina.ai/${encodeURIComponent(url)}`, {
      headers: {
        'Accept': 'text/markdown',
        'X-Return-Format': 'markdown',
      },
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      return { title: '', content: '', success: false };
    }

    const markdown = await response.text();
    const titleMatch = markdown.match(/^#\s+(.+)$/m);
    const title = titleMatch?.[1] || url;

    return { title, content: markdown, success: true };
  } catch {
    return { title: '', content: '', success: false };
  }
}
```

**修改后的 `lib/parser/webpage.ts`**:
```typescript
import { parseWithJina } from './jina';
import * as cheerio from 'cheerio';

export async function parseWebpage(url: string): Promise<WebpageParseResult> {
  // 优先使用 Jina Reader
  const jinaResult = await parseWithJina(url);
  if (jinaResult.success && jinaResult.content.length > 100) {
    return {
      title: jinaResult.title,
      content: jinaResult.content,
      sourceType: detectSourceType(url),
    };
  }

  // Fallback 到 cheerio（原有逻辑）
  return parseWithCheerio(url);
}
```

---

### Phase 4: 清理与稳定化（预计 0.5 天｜实际任务 3h）

#### 3.4.1 目标

- 清理未使用的依赖
- 更新项目文档反映新架构
- 全量回归测试验证
- 部署验证

#### 3.4.2 实施步骤

| 步骤 | 任务 | 交付物 | 估时 |
|------|------|--------|------|
| 4.1 | 移除未使用的依赖 | 清理 package.json | 0.5h |
| 4.2 | 更新 CLAUDE.md | 反映新架构 | 0.5h |
| 4.3 | 更新 SYSTEM_ARCHITECTURE.md | 反映框架变更 | 0.5h |
| 4.4 | 全量回归测试 | E2E smoke tests 全通过 | 1h |
| 4.5 | 部署验证 | Docker 构建 + 本地运行 | 0.5h |

---

## 4. 风险与缓解

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| Vercel AI SDK 不支持某些 Gemini 特性 | 低 | 中 | 保留直接调用路径作为 fallback |
| Inngest 免费额度不够 | 低 | 低 | 按需切换到 BullMQ + Redis |
| Jina Reader 不稳定 | 中 | 低 | 已有 cheerio fallback |
| 测试覆盖不足导致回归 | 中 | 高 | Phase 1 完成后立即补充集成测试 |

---

## 5. 时间线

```
2026-02-28  Phase 0 开始（对象存储迁移）
2026-03-01  Phase 0 完成，Phase 1 开始
2026-03-04  Phase 1 完成，Phase 2 开始
2026-03-05  Phase 2 完成，Phase 3 开始
2026-03-06  Phase 3 完成，Phase 4 开始
2026-03-06  Phase 4 完成，全量验收
```

**总预计工时**：6.5 天（日历排期，含缓冲时间）
- Phase 0: 1 天（对象存储迁移，实际任务 6.5h）
- Phase 1: 3 天（Vercel AI SDK，实际任务 12h）
- Phase 2: 1.5 天（Inngest，实际任务 5.5h）
- Phase 3: 0.5 天（Jina Reader，实际任务 2h）
- Phase 4: 0.5 天（清理稳定化，实际任务 ~3h）

**说明**：实际任务时间合计约 29h，日历排期 6.5 天包含了缓冲时间、测试调试、文档更新等非编码工作。

---

## 6. 代码量变化预估

**统计基准**（2026-02-28 验证）:
```bash
wc -l src/lib/gemini.ts src/lib/ai/agent/engine.ts src/lib/ingest/queue.ts \
      src/lib/ingest/retry.ts src/lib/ai/classifier.ts src/lib/ai/practiceConverter.ts
# 输出: 1193 total
```

| 模块 | 重构前 | 重构后 | 变化 |
|------|--------|--------|------|
| gemini.ts | 246 行 | 0 行（删除） | -246 |
| ai/client.ts | 0 行 | 30 行（新增） | +30 |
| agent/engine.ts | 544 行 | 200 行 | -344 |
| classifier.ts | 53 行 | 0 行（删除） | -53 |
| practiceConverter.ts | 67 行 | 0 行（删除） | -67 |
| ingest/queue.ts | 174 行 | 0 行（删除） | -174 |
| ingest/retry.ts | 109 行 | 109 行（保留） | 0 |
| inngest/* | 0 行 | 100 行（新增） | +100 |
| parser/jina.ts | 0 行 | 30 行（新增） | +30 |
| storage/* | 0 行 | 50 行（新增） | +50 |
| **总计** | ~1,193 行 | ~519 行 | **-674 行 (-56.5%)** |

---

## 7. 验收检查清单

### 7.1 功能验收

- [ ] URL 入库成功，AI 处理完成
- [ ] PDF 上传成功，AI 处理完成
- [ ] 纯文本入库成功，AI 处理完成
- [ ] 重新处理功能正常
- [ ] 知识库列表正常显示
- [ ] 条目详情页正常显示
- [ ] 练习队列正常工作

### 7.2 技术验收

- [ ] `npm run test` 全部通过
- [ ] `npm run build` 无错误
- [ ] `npm run lint` 无错误
- [ ] E2E smoke tests 全部通过
- [ ] Docker 构建成功
- [ ] 无未使用的依赖

### 7.3 文档验收

- [ ] CLAUDE.md 更新
- [ ] SYSTEM_ARCHITECTURE.md 更新
- [ ] README.md 更新（如有必要）

---

## 8. 后续规划（Phase 5+）

| 阶段 | 内容 | 触发条件 |
|------|------|----------|
| Phase 5 | pgvector 向量检索 | 去重精度需求明确 |
| Phase 6 | Entry 模型拆分完成 | 双写稳定 1 个月后 |
| Phase 7 | Unstructured PDF 解析 | 复杂 PDF 需求出现 |
| Phase 8 | OpenTelemetry 监控 | 性能问题出现 |

---

*计划制定时间: 2026-02-27*
*最后修订时间: 2026-02-28（基于架构评审四轮核验结果）*
*计划负责人: AI Assistant*
*待用户确认后启动*
