# Batch 2 (P1 改进) 实施计划

> 基于 2026-02-25 系统性升级设计
> 项目路径: /Users/ww/Desktop/mycode/ai_info_practice
> 状态: 待执行 | 前置依赖: Batch 1

## 概述

Batch 2 包含 7 个 P1 级别改进项：

1. B2.1 数据模型拆分 — Entry God Model → 职责清晰的分表
2. B2.2 Pipeline 工具系统启用 — builtin-tools.ts 集成到 engine.ts
3. B2.3 文档修正 — CLAUDE.md 目录结构、docs/README.md 索引、架构文档
4. B2.4 前端用户操作增强 — inline edit、笔记、状态操作
5. B2.5 Dashboard 行动导向 — 待审阅入口、趋势图、状态分布
6. B2.6 内容截断优化 — 语义分段替代头中尾采样
7. B2.7 新增摘要结构类型 — api-reference、comparison-matrix、timeline-evolution

---

## B2.1 数据模型拆分

### 目标
将 Entry 的 36 个字段拆分为职责清晰的表，解决 God Model 问题。

### 新数据模型

```
Entry (核心，保留最小必要字段)
  ├── 原始输入 (inputType, rawUrl, rawText, sourceType, title, originalContent)
  ├── 处理状态 (processStatus, processError)
  ├── 知识状态 (knowledgeStatus, reviewedAt, archivedAt) [来自 B1.2]
  ├── 用户标签 (userTags)
  └── 时间戳 (createdAt, updatedAt)

EntryAIResult (AI 提取结果，1:1)
  ├── contentType, techDomain, aiTags
  ├── coreSummary, practiceValue
  ├── summaryStructure, keyPoints, boundaries, confidence
  └── extractedMetadata [来自 B1.4]

EntryEvaluation (评估维度，1:1)
  ├── difficulty, contentForm, timeliness, sourceTrust
  └── qualityOverride

EntrySmartSummary (智能摘要，1:1，可选)
  ├── smartSummary, keyInsights, tldr
  └── generatedAt

EntryNote (用户笔记，1:many) [新增，B2.4]
  ├── content
  └── createdAt, updatedAt
```

### 迁移策略（4 Phase）

#### Phase 1: 创建新表 + 数据迁移
- 创建 EntryAIResult, EntryEvaluation, EntrySmartSummary, EntryNote 表
- 编写数据迁移脚本，从 Entry 复制数据到新表
- 保留 Entry 旧字段（过渡期）
- keyPoints 统一：keyPointsNew 优先，旧 keyPoints 作为 fallback

#### Phase 2: 更新 API 和业务逻辑

涉及文件：
- `src/app/api/ingest/route.ts` — AI 结果写入 EntryAIResult + EntryEvaluation
- `src/app/api/entries/route.ts` — findMany 添加 include，数据展平
- `src/app/api/entries/[id]/route.ts` — GET 添加 include，PATCH 路由到不同表
- `src/app/api/ai/smart-summary/route.ts` — 写入 EntrySmartSummary
- `src/app/api/dashboard/stats/route.ts` — 从新表查询统计
- `src/lib/ai/agent/engine.ts` — mergeTwoStepResults 返回分表结构
- `src/hooks/useEntries.ts` — 处理新的关联表结构，添加数据展平层

#### Phase 3: 更新前端组件
- `src/app/entry/[id]/page.tsx` — 数据访问路径改为 entry.aiResult.*
- `src/components/library/EntryCard.tsx` — props 接口更新
- `src/app/dashboard/page.tsx` — 数据结构处理更新

#### Phase 4: 清理旧字段
- 从 Entry 表删除已迁移字段
- 删除双写字段 keyPoints（保留 keyPointsNew 在 EntryAIResult 中）

### 变更顺序
1. Phase 1: 创建新表 + 迁移（必须最先）
2. Phase 2: API + 业务逻辑（依赖 Phase 1）
3. Phase 3: 前端组件（依赖 Phase 2）
4. Phase 4: 清理旧字段（确认无引用后）

### 验收标准
1. 所有现有 Entry 数据成功迁移到新表
2. API 返回数据结构保持兼容（通过展平层）
3. 前端页面正常显示，无数据丢失
4. 新入库的 Entry 正确写入分表
5. 所有单元测试通过

### 风险点
- 高风险：数据迁移 — 需备份数据库，使用事务
- 中等风险：前端数据路径变更 — 添加展平层缓解
- 低风险：关联查询性能 — 添加索引优化

### 依赖
- 依赖 B1.2（knowledgeStatus 字段）
- 依赖 B1.4（extractedMetadata 字段）

---

## B2.2 Pipeline 工具系统启用

### 目标
将硬编码的两步流程改为工具驱动的 ReAct loop。

### Phase 1: 最小启用（保持两步结构）

涉及文件：
- `src/lib/ai/agent/engine.ts` — runStep1/runStep2 改为调用工具
- `src/lib/ai/agent/builtin-tools.ts` — 增强 classify_content 和 extract_summary

变更：
- engine.ts 的 runStep1 调用 toolsRegistry.get('classify_content')
- engine.ts 的 runStep2 调用 toolsRegistry.get('extract_summary')
- builtin-tools.ts 的工具实现复用 engine.ts 的 prompt 构建逻辑

### Phase 2: 差异化路由（按内容类型选择工具）

涉及文件：
- `src/lib/ai/agent/route-strategy.ts` — 启用路由工具
- `src/lib/ai/agent/engine.ts` — Step 1 和 Step 2 之间插入路由
- `src/lib/ai/agent/builtin-tools.ts` — 新增 extract_code、extract_version 工具

路由规则：
| ContentType | 工具组合 |
|-------------|---------|
| TUTORIAL | classify → route → extract_code → extract_summary |
| TOOL_RECOMMENDATION | classify → route → extract_version → extract_summary |
| 其他 | classify → extract_summary（默认） |

### 验收标准
1. Phase 1: 现有流程通过工具执行，行为不变
2. Phase 2: TUTORIAL 使用 extract_code，TOOL_RECOMMENDATION 使用 extract_version
3. ReasoningTrace 正确记录工具调用
4. 失败时 fallback 到默认流程

### 风险点
- 中等风险：工具调用失败 — 添加 fallback 机制
- 低风险：性能下降 — 监控并优化

### 依赖
- 依赖 B1.4（extractedMetadata 字段）

---

## B2.3 文档修正

### 涉及文件
- `CLAUDE.md`（Line 81-110 目录结构）
- `docs/README.md`（补全 11 个 plan 索引 + architecture/ 展开）
- `docs/architecture/SYSTEM_ARCHITECTURE.md`（补充 agent/ 模块说明）

### 具体变更
1. CLAUDE.md：移除 extractor.ts，添加 agent/ 子目录（engine.ts, builtin-tools.ts, route-strategy.ts, schemas.ts, types.ts, config.ts）
2. docs/README.md：补全所有 plan 文档索引，展开 architecture/ 目录列表
3. SYSTEM_ARCHITECTURE.md：AI 处理管道表格添加 agent/ 模块

### 验收标准
- 目录结构准确反映当前代码
- 所有文档在索引中可找到

### 风险点
- 无，纯文档修改

---

## B2.4 前端用户操作增强

### 涉及文件
- `src/app/entry/[id]/page.tsx`（添加 inline edit）
- `src/components/entry/InlineEdit.tsx`（新建）
- `src/components/entry/TagEditor.tsx`（新建）
- `src/components/entry/NotePanel.tsx`（新建）
- `src/app/api/entries/[id]/notes/route.ts`（新建）
- `src/hooks/useEntryNotes.ts`（新建）

### 具体变更
1. InlineEdit 组件：点击标题变为输入框，失焦/Enter 保存
2. TagEditor 组件：用户标签的添加/删除 UI
3. NotePanel 组件：笔记列表 + 添加笔记表单
4. Notes API：CRUD /api/entries/[id]/notes
5. useEntryNotes hook：笔记的增删改查

### 验收标准
1. 可 inline 编辑标题
2. 可添加/删除用户标签
3. 可添加/编辑/删除笔记
4. 所有操作即时保存

### 依赖
- 依赖 B2.1（EntryNote 模型）

---

## B2.5 Dashboard 行动导向

### 涉及文件
- `src/app/dashboard/page.tsx`（修改）
- `src/app/api/dashboard/stats/route.ts`（修改）

### 具体变更
1. API 新增统计：按 knowledgeStatus 分组计数、本周趋势数据
2. Dashboard 新增：
   - "待审阅" 卡片（数量 + 点击跳转 Library?knowledgeStatus=TO_REVIEW）
   - knowledgeStatus 分布饼图
   - 本周新增趋势折线图（简单的 7 天数据）

### 验收标准
1. Dashboard 显示待审阅数量
2. 点击待审阅跳转到 Library 筛选页
3. 状态分布图正确显示

### 依赖
- 依赖 B1.2（knowledgeStatus 字段）

---

## B2.6 内容截断优化

### 涉及文件
- `src/lib/ai/agent/engine.ts`（修改 buildContentSnapshot）

### 具体变更

当前 buildContentSnapshot（Line 145-163）使用头中尾采样，Step 1 限制 12K 字符。

优化方案：
- 短内容（<12K）：全文传入，不截断
- 中等内容（12K-50K）：按段落分割，取每段首句 + 关键句
- 长内容（>50K）：先用轻量 prompt 生成结构化大纲，再传入 Agent

实现：
1. 新增 `buildSemanticSnapshot` 函数
2. 按 `\n\n` 分段，每段取前 2 句
3. 保留代码块完整性（不在代码块中间截断）

### 验收标准
1. 短内容不被截断
2. 中等内容保留每段关键信息
3. 代码块不被截断

### 风险点
- 中等风险：语义分段质量 — 需测试不同格式的内容

### 依赖
- 无直接依赖

---

## B2.7 新增摘要结构类型

### 涉及文件
- `src/lib/ai/agent/schemas.ts`（新增 3 个 schema）
- `src/lib/ai/agent/engine.ts`（Step 1 prompt 添加新类型说明）
- `src/lib/ai/agent/ingest-contract.ts`（SummaryStructureType 扩展）
- `src/components/entry/ApiReference.tsx`（新建）
- `src/components/entry/ComparisonMatrix.tsx`（新建）
- `src/components/entry/TimelineEvolution.tsx`（新建）
- `src/components/entry/DynamicSummary.tsx`（修改，添加新类型渲染）

### 具体变更

新增 3 种摘要结构类型：

1. `api-reference`：参数表、返回值、示例代码、错误码
2. `comparison-matrix`：多工具/方案横向对比表格
3. `timeline-evolution`：版本时间线、关键变化点

每种类型需要：
- Zod schema 定义（schemas.ts）
- 前端渲染组件
- DynamicSummary 中的类型路由
- Step 1 prompt 中的类型说明

### 验收标准
1. API 文档类内容自动识别为 api-reference 结构
2. 对比类内容自动识别为 comparison-matrix 结构
3. 技术演进类内容自动识别为 timeline-evolution 结构
4. 前端正确渲染新结构类型

### 风险点
- 中等风险：AI 识别准确率 — 需要 few-shot examples
- 低风险：前端组件复杂度 — 保持简洁

### 依赖
- 无直接 Batch 1 依赖

---

## 执行顺序总结

```
B2.3 文档修正（独立，可随时做）
  ↓
B2.1 数据模型拆分（最复杂，优先做）
  ├── Phase 1: 创建新表 + 迁移
  ├── Phase 2: API + 业务逻辑
  ├── Phase 3: 前端组件
  └── Phase 4: 清理旧字段
  ↓
B2.4 前端用户操作增强（依赖 B2.1 的 EntryNote）
B2.5 Dashboard 行动导向（依赖 B1.2）
  ↓
B2.2 Pipeline 工具系统启用（可与 B2.4/B2.5 并行）
B2.6 内容截断优化（独立）
B2.7 新增摘要结构类型（独立）
```

---

*创建时间: 2026-02-25*
*状态: 待执行*
