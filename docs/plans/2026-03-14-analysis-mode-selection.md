# 用户选择 AI 分析模式 — 方案设计

> 日期：2026-03-14
> 状态：草稿

## 1. 需求概述

当前 AI 分析模式（tool-calling / two-step）由服务端环境变量 `REACT_AGENT_USE_TOOLS` 全局控制，用户无法在上传时按内容特点自主选择。

目标：在上传对话框中增加模式选择器，让用户在提交时指定分析模式，该选择随请求传递到 Worker 并生效。

推荐场景：
- 短文 / 结构清晰 → `two-step`（速度快、成本低）
- 长文 / 复杂内容 → `tool-calling`（工具辅助、质量高）
- 不确定 → `auto`（沿用服务端默认）

---

## 2. 现状分析

### 2.1 模式控制链路

```
环境变量 REACT_AGENT_USE_TOOLS
    ↓
src/lib/ai/agent/config.ts  getDefaultConfig()
    → useToolCalling: process.env.REACT_AGENT_USE_TOOLS !== 'false'（默认 true）
    ↓
src/lib/ai/agent/engine.ts  executeReasoning()
    → if (this.config.useToolCalling) → executeWithTools()
    → else → executeTwoStepReasoning()
```

### 2.2 现有 config 传递路径

```
localStorage["ai-practice-config"]  { credentialId, geminiModel }
    ↓ useIngest.ts  getConfig()
    ↓ fetch POST /api/ingest  body.config
    ↓ ingest/route.ts  仅用 config.credentialId 创建 Entry，config 不持久化
    ↓ inngest.send({ name: 'entry/ingest', data: { entryId } })
    ↓ process-entry.ts  仅从 entry.credentialId 恢复 API Key，无 analysisMode
```

**关键缺口**：`config.analysisMode` 目前不存在；即使前端传了，Worker 也不会读取。

---

## 3. 方案设计

### 3.1 UI 层 — IngestDialog 增加模式选择器

文件：`src/components/ingest/IngestDialog.tsx`

在提交按钮上方增加一个紧凑的三选一选择器：

```
分析模式：  [Auto ▾]  [Two-step]  [Tool-calling]
```

- 默认选中 `auto`
- 用 `useState<'auto' | 'two-step' | 'tool-calling'>` 管理
- 提交时作为参数传给 mutation

### 3.2 Hook 层 — useIngest 传递 analysisMode

文件：`src/hooks/useIngest.ts`

**改动点：**

1. 三个 mutation 的参数接口各增加可选字段：
   ```ts
   interface IngestLinkParams {
     url: string;
     analysisMode?: 'auto' | 'two-step' | 'tool-calling';
   }
   // IngestFileParams / IngestTextParams 同理
   ```

2. `getConfig()` 不变（仍只读 credentialId / geminiModel）；`analysisMode` 作为独立参数随 body 传递，不存入 localStorage（属于一次性选择，不需要持久化）：
   ```ts
   body: JSON.stringify({ inputType: "LINK", url, config, analysisMode })
   ```

### 3.3 API 层 — ingest/route.ts 持久化 analysisMode

文件：`src/app/api/ingest/route.ts`

**改动点：**

1. 解构 body 时增加 `analysisMode`：
   ```ts
   const { inputType, url, fileUrl, text, config, analysisMode } = body;
   ```

2. 创建 Entry 时写入数据库（需要 Prisma schema 支持，见 3.5）：
   ```ts
   await prisma.entry.create({
     data: {
       ...
       analysisMode: analysisMode ?? null,   // 'two-step' | 'tool-calling' | null
     },
   });
   ```

3. Inngest event data 不需要改动（Worker 从 DB 读取）。

### 3.4 Worker 层 — process-entry.ts 读取并应用 analysisMode

文件：`src/lib/inngest/functions/process-entry.ts`

**改动点（在 `parse-content` step 中已加载 entry）：**

在调用 `createAgentEngine` 之前，根据 `entry.analysisMode` 决定如何构造 config：

```ts
// 在 'analyze-content' step 内
const agentConfig = getDefaultConfig();

if (entry.analysisMode === 'two-step') {
  agentConfig.useToolCalling = false;
} else if (entry.analysisMode === 'tool-calling') {
  agentConfig.useToolCalling = true;
}
// 'auto' 或 null → 保持 getDefaultConfig() 的默认值（由环境变量决定）

const agent = createAgentEngine(agentConfig);
```

> 注意：`entry` 对象需要在 `analyze-content` step 中重新查询或从 `parse-content` step 的返回值中携带 `analysisMode` 字段。

### 3.5 数据库层 — Prisma Schema

文件：`prisma/schema.prisma`

在 `Entry` model 增加字段：

```prisma
analysisMode  String?   // 'two-step' | 'tool-calling' | null(=auto)
```

执行迁移：
```bash
docker compose exec app npx prisma db push
```

---

## 4. 涉及文件清单

| 文件 | 改动类型 | 改动内容 |
|------|----------|----------|
| `prisma/schema.prisma` | 字段新增 | `Entry.analysisMode String?` |
| `src/hooks/useIngest.ts` | 接口 + 传参 | 三个 Params 接口加 `analysisMode?`，body 中透传 |
| `src/app/api/ingest/route.ts` | 解构 + 写库 | 读取 `analysisMode`，写入 Entry |
| `src/lib/inngest/functions/process-entry.ts` | 逻辑分支 | 读 `entry.analysisMode`，覆盖 `agentConfig.useToolCalling` |
| `src/components/ingest/IngestDialog.tsx` | UI 新增 | 模式选择器 state + 渲染 + 传参 |

不需要改动：
- `src/lib/ai/agent/engine.ts` — `executeReasoning` 已正确读取 `config.useToolCalling`
- `src/lib/ai/agent/config.ts` — `getDefaultConfig()` 保持不变，作为 `auto` 的 fallback

---

## 5. 数据流总览

```
IngestDialog
  analysisMode state ('auto' | 'two-step' | 'tool-calling')
    ↓ mutate({ url, analysisMode })
useIngest.ingestLink/ingestText/ingestFile
    ↓ POST /api/ingest  body: { ..., analysisMode }
ingest/route.ts
    ↓ prisma.entry.create({ analysisMode })
    ↓ inngest.send({ entryId })          ← event data 不变
process-entry.ts  (step: analyze-content)
    ↓ entry.analysisMode → agentConfig.useToolCalling
    ↓ createAgentEngine(agentConfig)
engine.ts  executeReasoning()
    ↓ useToolCalling → executeWithTools() / executeTwoStepReasoning()
```

---

## 6. 风险与注意事项

1. **Inngest 重试一致性**：`entry.analysisMode` 存在 DB，重试时读取的值与首次一致，不受前端状态影响。

2. **process-entry step 边界**：`entry` 对象在 `parse-content` step 中加载，但 `analyze-content` step 是独立 step，需确保 `analysisMode` 字段被包含在 `parse-content` 的返回值中（或在 `analyze-content` step 内重新查询 entry）。

3. **schema 迁移**：`analysisMode` 为可选字段，`db push` 不影响现有数据，存量 Entry 默认 `null`（等同于 `auto`）。

4. **UI 简洁性**：选择器不应喧宾夺主。建议用小字号的 segmented control 或 radio group，放在提交按钮上方，折叠在"高级选项"内也可接受。

5. **批量 URL 模式**：IngestDialog 支持多 URL 批量提交，所有 URL 共享同一个 `analysisMode` 选择，符合预期（用户一次选择应用于本批次）。

---

## 实施计划

> Codex 评审反馈落实说明：
> - `auto` 不写 DB，前端传 `'auto'` 时 API 层映射为 `null`
> - API 层用 zod 白名单校验，只允许 `'two-step' | 'tool-calling' | null`
> - 用户选择优先级高于环境变量（个人项目，用户意图优先）
> - 新增可选字段，`prisma db push` 即可，无需数据迁移

---

### Step 1: Schema 变更

**文件**：`prisma/schema.prisma`

在 `Entry` model 的 `originalExecutionMode` 字段（line 80）附近新增一行：

```prisma
  analysisMode    String?   // 'two-step' | 'tool-calling' | null(=auto)
  originalExecutionMode String? // 'two-step' or 'tool-calling'
```

**执行迁移**（无需数据迁移，可选字段，存量数据默认 null）：

```bash
docker compose exec app npx prisma db push
docker compose exec app npx prisma generate
```

---

### Step 2: API 层

**文件**：`src/app/api/ingest/route.ts`

**改动 1**：解构 body 时增加 `analysisMode`，并用 zod 白名单校验（在现有 inputType 校验之后）：

```ts
// 在文件顶部增加 import
import { z } from 'zod';

// 在 body 解构处（当前 line ~11）
const { inputType, url, fileUrl, text, config, analysisMode: rawAnalysisMode } = body;

// 在 inputType 校验之后，新增 analysisMode 校验
const analysisModeSchema = z.enum(['two-step', 'tool-calling']).nullable().optional();
const analysisModeResult = analysisModeSchema.safeParse(
  rawAnalysisMode === 'auto' ? null : rawAnalysisMode ?? null
);
if (!analysisModeResult.success) {
  return NextResponse.json(
    { error: "Invalid analysisMode. Must be 'two-step', 'tool-calling', or 'auto'." },
    { status: 400 }
  );
}
const analysisMode = analysisModeResult.data ?? null;  // 'two-step' | 'tool-calling' | null
```

**改动 2**：`prisma.entry.create` 的 data 对象（当前 line ~97）增加字段：

```ts
const entry = await prisma.entry.create({
  data: {
    inputType,
    rawUrl: inputType === "LINK" ? url : inputType === "PDF" ? fileUrl : null,
    rawText: inputType === "TEXT" ? text : null,
    sourceType,
    credentialId: config?.credentialId || null,
    processStatus: "PENDING",
    analysisMode,   // ← 新增，null 表示 auto
  },
});
```

---

### Step 3: Worker 层

**文件**：`src/lib/inngest/functions/process-entry.ts`

**改动**：在 `createAgentEngine()` 调用处（当前 line 266）替换为带 config 的版本：

```ts
// 替换前（line 266）：
const agent = await createAgentEngine();

// 替换后：
import { getDefaultConfig } from '@/lib/ai/agent/config';

const agentConfig = getDefaultConfig();
// 用户选择优先级高于环境变量（个人项目）
if (entry.analysisMode === 'two-step') {
  agentConfig.useToolCalling = false;
} else if (entry.analysisMode === 'tool-calling') {
  agentConfig.useToolCalling = true;
}
// null → 保持 getDefaultConfig() 默认值（由 REACT_AGENT_USE_TOOLS 决定）
const agent = await createAgentEngine(agentConfig);
```

> `entry` 对象在 line 146 已通过 `prisma.entry.findUnique` 加载，`analysisMode` 字段在 schema 新增后会自动包含，无需额外查询。

---

### Step 4: Hook 层

**文件**：`src/hooks/useIngest.ts`

**改动 1**：三个参数接口各增加可选字段：

```ts
interface IngestLinkParams {
  url: string;
  analysisMode?: 'auto' | 'two-step' | 'tool-calling';
}

interface IngestFileParams {
  file: File;
  analysisMode?: 'auto' | 'two-step' | 'tool-calling';
}

interface IngestTextParams {
  text: string;
  analysisMode?: 'auto' | 'two-step' | 'tool-calling';
}
```

**改动 2**：三个 mutationFn 的 body 各增加 `analysisMode` 透传（`getConfig()` 不变）：

```ts
// ingestLink（当前 body: JSON.stringify({ inputType: "LINK", url, config })）
body: JSON.stringify({ inputType: "LINK", url, config, analysisMode }),

// ingestFile（当前 body: JSON.stringify({ inputType: "PDF", fileUrl, config })）
body: JSON.stringify({ inputType: "PDF", fileUrl, config, analysisMode }),

// ingestText（当前 body: JSON.stringify({ inputType: "TEXT", text, config })）
body: JSON.stringify({ inputType: "TEXT", text, config, analysisMode }),
```

---

### Step 5: UI 层

**文件**：`src/components/ingest/IngestDialog.tsx`

**改动 1**：在现有 `useState` 声明区（line 18-23）增加 state：

```ts
const [analysisMode, setAnalysisMode] = useState<'auto' | 'two-step' | 'tool-calling'>('auto');
```

**改动 2**：`handleSubmit` 中三处 mutate 调用各增加参数（line 76、79、81）：

```ts
ingestLink.mutate({ url: urls[0], analysisMode });
ingestFile.mutate({ file, analysisMode });
ingestText.mutate({ text: text.trim(), analysisMode });
```

**改动 3**：在提交按钮上方（`onClick={handleSubmit}` 所在按钮之前，约 line 340）插入选择器 UI：

```tsx
{/* 分析模式选择器 */}
<div className="flex items-center gap-2 text-sm">
  <span className="text-muted-foreground">分析模式：</span>
  {(['auto', 'two-step', 'tool-calling'] as const).map((mode) => (
    <button
      key={mode}
      type="button"
      onClick={() => setAnalysisMode(mode)}
      className={`px-2 py-0.5 rounded border text-xs transition-colors ${
        analysisMode === mode
          ? 'border-primary text-primary bg-primary/10'
          : 'border-border text-muted-foreground hover:border-foreground'
      }`}
    >
      {mode === 'auto' ? 'Auto' : mode === 'two-step' ? 'Two-step' : 'Tool-calling'}
    </button>
  ))}
</div>
```

---

### Step 6: 验证

```bash
# 1. 类型检查（确认 Prisma 类型、接口定义无误）
docker compose exec app npm run type-check

# 2. Lint
docker compose exec app npm run lint

# 3. 手动验证流程
# - 打开 IngestDialog，确认三个模式按钮渲染正常
# - 选择 'two-step'，提交一条 URL
# - 查看 DB：entry.analysisMode 应为 'two-step'
# - 查看 Inngest 日志：agent 应走 executeTwoStepReasoning 路径
# - 选择 'auto'，提交：entry.analysisMode 应为 null
# - 传入非法值（如 'invalid'）：API 应返回 400
```
