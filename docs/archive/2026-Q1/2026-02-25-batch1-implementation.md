# Batch 1 (P0 修复) 实施计划

> 基于 2026-02-25 系统性升级设计
> 项目路径: /Users/ww/Desktop/mycode/ai_info_practice
> 状态: 待执行

## 概述

Batch 1 包含 4 个 P0 级别工作项：

1. B1.1 CLAUDE.md 修正 — 更新过时的项目规范文档
2. B1.2 知识管理状态模型 — 引入混合式生命周期状态管理
3. B1.3 Entry 详情页信息重构 — 解决信息冗余和结构混乱
4. B1.4 AI 信息提取增强 — 按内容类型差异化提取关键信息

---

## B1.1 CLAUDE.md 修正

### 涉及文件
- `CLAUDE.md`

### 具体变更

1. 阶段治理定义更新（Line 5-7）：Phase 1 规划中 → Phase 1-4 已完成 + 当前阶段：系统性升级
2. 修复 Line 79 格式错误：`-**: Docker **` → `- **部署**: Docker + docker-compose`
3. 更新目录结构（Line 81-119）：移除 `extractor.ts`，添加 `agent/` 子目录（engine.ts, builtin-tools.ts, route-strategy.ts, schemas.ts, types.ts）
4. 更新 AI 处理管道说明（Line 121-131）：L1/L2/L3 → Parser + ReAct Agent 两步推理

### 验收标准
- 阶段定义反映当前项目状态
- 目录结构准确反映 src/lib/ai/agent/ 的实际文件
- AI 处理管道说明与 engine.ts 实现一致

### 风险点
- 低风险：纯文档修改

---

## B1.2 知识管理状态模型

### 涉及文件

数据模型层：
- `prisma/schema.prisma`

业务逻辑层（新建）：
- `src/lib/entries/knowledge-status.ts`

API 层：
- `src/app/api/entries/[id]/status/route.ts`（新建）
- `src/app/api/entries/route.ts`（修改 GET 增加筛选）
- `src/app/api/ingest/route.ts`（修改，AI 处理完成后自动流转）

类型定义层：
- `src/types/index.ts`

前端组件层：
- `src/components/entry/StatusActions.tsx`（新建）
- `src/app/entry/[id]/page.tsx`（修改，集成状态操作）
- `src/app/library/LibraryPageClient.tsx`（修改，添加状态筛选 Tab）
- `src/components/library/EntryCard.tsx`（修改，添加状态标识）

Hooks 层：
- `src/hooks/useEntries.ts`（修改，添加 knowledgeStatus 参数）
- `src/hooks/useEntryStatus.ts`（新建）

### 具体变更

#### 1. Prisma Schema

新增 KnowledgeStatus 枚举：
```
PENDING → TO_REVIEW → ACTIVE → ARCHIVED | DEPRECATED
```

Entry model 新增字段：
- `knowledgeStatus KnowledgeStatus @default(PENDING)`
- `reviewedAt DateTime?`
- `archivedAt DateTime?`
- `deprecatedReason String?`
- 索引：`@@index([knowledgeStatus])`, `@@index([knowledgeStatus, reviewedAt])`

#### 2. 状态流转逻辑 (knowledge-status.ts)

允许的流转：
- PENDING → TO_REVIEW（自动，AI 处理完成时）
- TO_REVIEW → ACTIVE（用户确认）
- ACTIVE → ARCHIVED（用户归档）
- ACTIVE → DEPRECATED（用户标记过时，需填写原因）
- ARCHIVED → ACTIVE（恢复）

导出函数：canTransition(), requiresReason(), shouldAutoTransitionToReview()

#### 3. API 端点

新建 PATCH /api/entries/[id]/status：
- 验证 status 合法性
- 检查流转规则（canTransition）
- 检查 reason 必填性（requiresReason）
- 更新 knowledgeStatus + 相关时间戳
- 返回 { data: updatedEntry }

修改 GET /api/entries：
- 新增 knowledgeStatus 查询参数
- 在 where 条件中添加筛选

#### 4. 自动状态流转

在 AI 处理完成（processStatus = DONE）时，自动将 knowledgeStatus 从 PENDING 设为 TO_REVIEW。

#### 5. 前端组件

StatusActions.tsx：
- 根据 currentStatus 显示可用操作按钮
- TO_REVIEW: 显示"确认"按钮
- ACTIVE: 显示"归档"和"标记过时"按钮
- ARCHIVED: 显示"恢复"按钮
- DEPRECATED 标记需弹出原因输入框

Library 页面：
- 添加状态筛选 Tab（全部 / 待审阅 / 活跃 / 归档 / 过时）
- 待审阅 Tab 显示数量 badge

EntryCard：
- 待审阅条目显示黄色标识
- 已过时条目显示红色标识

### 变更顺序
1. schema.prisma → 运行迁移
2. knowledge-status.ts（业务逻辑）
3. API 端点（status route + entries route + ingest route）
4. types/index.ts
5. Hooks（useEntries.ts + useEntryStatus.ts）
6. 组件（StatusActions + page.tsx + LibraryPageClient + EntryCard）

### 验收标准
1. 数据库迁移成功，新字段和 Enum 已创建
2. AI 处理完成后自动流转到 TO_REVIEW
3. Entry 详情页显示状态操作按钮
4. 用户可执行所有合法状态流转
5. Library 页面可按状态筛选
6. EntryCard 显示状态标识
7. 非法流转被拒绝（400）
8. 标记过时未填原因被拒绝

### 风险点
- 中等风险：现有数据迁移 — 需将 processStatus=DONE 的条目批量更新为 TO_REVIEW
- 低风险：前端状态同步 — mutation onSuccess 中 invalidate 相关查询

---

## B1.3 Entry 详情页信息重构

### 涉及文件
- `src/app/entry/[id]/page.tsx`
- `src/components/entry/MetadataPanel.tsx`
- `src/components/entry/DynamicSummary.tsx`

### 具体变更

#### 1. Tab 结构调整

当前：Overview | Summary | Trace | Quality
调整为：Overview | Summary | Practice | Related | Trace | Quality

#### 2. 内容重新分配

Overview Tab（保留）：
- 状态操作（B1.2 新增）
- 标签（aiTags + userTags）— 只在此处显示
- 元数据面板（移除 coreSummary 展示）

Summary Tab（精简）：
- 动态摘要（DynamicSummary 组件）
- 关键点（统一用 keyPointsNew，移除旧 keyPoints）
- 适用边界（boundaries）

Practice Tab（从 Summary 独立）：
- 练习任务（practiceTask）
- 步骤列表（steps）

Related Tab（从 Summary 独立）：
- 智能摘要（smartSummary + keyInsights + tldr）
- 关联条目（relatedEntries）

Trace Tab（保留）：推理轨迹
Quality Tab（保留）：质量面板

#### 3. 去重规则
- coreSummary：只在 Summary Tab 的 DynamicSummary 中显示，从 MetadataPanel 移除
- keyPoints：统一用 keyPointsNew 结构，删除旧 keyPoints 展示逻辑
- aiTags：只在 Overview Tab 显示，从 Summary Tab 移除

### 变更顺序
1. 修改 Tab 定义和路由
2. 拆分 Summary Tab 内容到 Practice 和 Related
3. 清理 MetadataPanel 中的重复字段
4. 统一 keyPoints 展示

### 验收标准
1. 6 个 Tab 正常切换
2. 无信息重复展示
3. 所有原有信息在新结构中可访问
4. Practice Tab 正确显示练习任务
5. Related Tab 正确显示关联条目

### 风险点
- 中等风险：Tab 拆分可能影响现有的 URL hash 导航
- 低风险：组件 props 变更需同步更新

---

## B1.4 AI 信息提取增强

### 涉及文件
- `src/lib/ai/agent/engine.ts`（修改 Step 2 prompt）
- `src/lib/ai/agent/ingest-contract.ts`（扩展 NormalizedAgentIngestDecision）
- `src/lib/ai/agent/schemas.ts`（新增 extractedMetadata schema）
- `prisma/schema.prisma`（Entry 新增 extractedMetadata 字段）

### 具体变更

#### 1. 数据模型

Entry model 新增：
```prisma
extractedMetadata Json? // { author?, publishDate?, codeExamples?, references?, versionInfo? }
```

#### 2. Schema 定义 (schemas.ts)

新增 ExtractedMetadata Zod schema：
```typescript
const extractedMetadataSchema = z.object({
  author: z.string().optional(),
  publishDate: z.string().optional(),
  sourceUrl: z.string().optional(),
  codeExamples: z.array(z.object({
    language: z.string(),
    code: z.string(),
    description: z.string(),
  })).optional(),
  references: z.array(z.object({
    title: z.string(),
    url: z.string(),
    type: z.enum(['official', 'blog', 'paper', 'repo']),
  })).optional(),
  versionInfo: z.object({
    tool: z.string(),
    version: z.string(),
    releaseDate: z.string().optional(),
  }).optional(),
});
```

#### 3. 差异化提取 (engine.ts)

修改 buildStep2Prompt 函数，根据 Step 1 识别的 contentType 注入差异化提取指令：

| ContentType | 额外提取指令 |
|-------------|-------------|
| TUTORIAL | 重点提取 codeExamples 和 references |
| TOOL_RECOMMENDATION | 重点提取 versionInfo 和 references |
| TECH_PRINCIPLE | 重点提取 references（论文/来源） |
| CASE_STUDY | 重点提取 author 和 references |
| OPINION | 重点提取 author 和 publishDate |

在 Step 2 prompt 的 JSON schema 中添加 extractedMetadata 字段要求。

#### 4. 契约更新 (ingest-contract.ts)

NormalizedAgentIngestDecision 接口新增：
```typescript
extractedMetadata?: ExtractedMetadata;
```

normalize 函数中添加 extractedMetadata 的验证和默认值处理。

### 变更顺序
1. schema.prisma 新增字段 → 迁移
2. schemas.ts 新增 Zod schema
3. ingest-contract.ts 扩展接口
4. engine.ts 修改 Step 2 prompt

### 验收标准
1. 新入库的 TUTORIAL 类型条目包含 codeExamples
2. 新入库的 TOOL_RECOMMENDATION 类型条目包含 versionInfo
3. extractedMetadata 通过 Zod 校验
4. 现有条目不受影响（字段为 optional）

### 风险点
- 中等风险：Prompt 修改可能影响现有提取质量 — 需 A/B 测试
- 低风险：JSON 字段无 DB 级约束，schema 变更安全

---

## 执行顺序总结

```
B1.1 CLAUDE.md 修正（独立，可随时做）
  ↓
B1.2 知识管理状态模型
  ├── schema.prisma 变更（与 B1.4 合并一次迁移）
  ├── 业务逻辑 + API
  └── 前端组件
  ↓
B1.3 Entry 详情页重构（依赖 B1.2 的 StatusActions）
  ↓
B1.4 AI 信息提取增强（独立，但 schema 变更与 B1.2 合并）
```

建议将 B1.2 和 B1.4 的 schema 变更合并为一次 prisma db push。

---

*创建时间: 2026-02-25*
*状态: 待执行*
