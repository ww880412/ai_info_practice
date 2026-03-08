# AI Practice Hub 系统性升级设计

> 基于 2026-02-25 全维度评审，覆盖 6 个维度 28 个发现项。
> 按 P0 → P1 横切执行，每批次独立可交付。

## 评审总览

| 维度 | 评分 | 核心问题 |
|------|------|---------|
| 1. 项目规范与文档 | 6.2/10 | CLAUDE.md 过时、索引缺失、plan 未归档 |
| 2. 前端展示与交互 | 5/10 | 无知识管理状态、信息冗余、缺少用户操作 |
| 3. AI 信息提取与分层 | 6/10 | 信息丢失严重、无差异化处理 |
| 4. 数据模型 | 7/10 | Entry God Model、双写字段 |
| 5. Pipeline 可扩展性 | 5/10 | 工具系统/路由策略已实现但未启用 |
| 6. 文档归档治理 | 3/10 | 已完成 plan 未归档 |

---

## Batch 1: P0 修复（5 项）

### B1.1 CLAUDE.md 修正
- **D1.1**: 更新阶段治理定义，Phase 1-4 标记为已完成
- **D1.3**: 修复 Line 79 格式错误
- 更新目录结构，移除 `extractor.ts`，添加 `agent/` 子目录

### B1.2 知识管理状态模型（F2.1）

引入混合式生命周期状态：

```
PENDING → TO_REVIEW → ACTIVE → ARCHIVED | DEPRECATED
```

数据模型变更：
```prisma
enum KnowledgeStatus {
  PENDING      // 待处理 - 刚入库，AI 尚未处理
  TO_REVIEW    // 待审阅 - AI 处理完成，等待用户确认/修正
  ACTIVE       // 活跃 - 用户确认，正常使用中
  ARCHIVED     // 归档 - 不再活跃但保留参考价值
  DEPRECATED   // 过时 - 信息已过时或被替代
}

model Entry {
  knowledgeStatus  KnowledgeStatus @default(PENDING)
  reviewedAt       DateTime?       // 用户审阅时间
  archivedAt       DateTime?       // 归档时间
  deprecatedReason String?         // 过时原因
}
```

状态流转规则：
- `PENDING → TO_REVIEW`：AI 处理完成（processStatus = DONE）时自动流转
- `TO_REVIEW → ACTIVE`：用户在详情页确认或修正后流转
- `ACTIVE → ARCHIVED`：用户手动归档
- `ACTIVE → DEPRECATED`：用户标记过时，需填写原因
- `ARCHIVED → ACTIVE`：可恢复

前端变更：
- Library 页面增加状态筛选 tab（全部 / 待审阅 / 活跃 / 归档 / 过时）
- Entry 详情页增加状态操作按钮（确认 / 归档 / 标记过时）
- EntryCard 显示状态标识

### B1.3 Entry 详情页信息重构（F2.2）

当前问题：Summary Tab 包含 7 个区块，coreSummary 和 keyPoints 多处重复。

重构方案：
```
Tab 结构调整：
  Overview  → 保留：标签、状态操作、元数据面板
  Summary   → 拆分为：核心摘要（动态结构）+ 关键点
  Practice  → 从 Summary 独立：练习任务 + 步骤
  Related   → 从 Summary 独立：关联条目 + 智能摘要
  Trace     → 保留：推理轨迹
  Quality   → 保留：质量面板
```

去重规则：
- coreSummary 只在 Summary Tab 显示（从 MetadataPanel 移除）
- keyPoints 统一用 keyPointsNew 结构，删除旧 keyPoints 展示
- aiTags 只在 Overview Tab 显示

### B1.4 AI 信息提取增强（A3.1 + A3.2）

核心问题：代码片段、外部链接、作者、版本号等关键信息未提取。

方案：扩展 Agent Step 2 的提取 schema，按内容类型差异化。

新增提取字段：
```typescript
interface ExtractedMetadata {
  // 通用字段
  author?: string;
  publishDate?: string;
  sourceUrl?: string;

  // 按内容类型差异化
  codeExamples?: Array<{
    language: string;
    code: string;
    description: string;
  }>;
  references?: Array<{
    title: string;
    url: string;
    type: 'official' | 'blog' | 'paper' | 'repo';
  }>;
  versionInfo?: {
    tool: string;
    version: string;
    releaseDate?: string;
  };
}
```

内容类型差异化策略：
| ContentType | 额外提取 | 优先级 |
|-------------|---------|--------|
| TUTORIAL | codeExamples, references | 代码示例最重要 |
| TOOL_RECOMMENDATION | versionInfo, references | 版本和链接最重要 |
| TECH_PRINCIPLE | references | 论文/来源最重要 |
| CASE_STUDY | author, references | 作者背景最重要 |
| OPINION | author, publishDate | 时效性和作者最重要 |

实现方式：修改 engine.ts Step 2 prompt，根据 Step 1 识别的 contentType 注入差异化提取指令。

---

## Batch 2: P1 改进（11 项）

### B2.1 数据模型拆分（M4.1 + M4.2）

将 Entry 的 36 个字段拆分为职责清晰的表：

```
Entry (核心)
  ├── 原始输入字段 (inputType, rawUrl, rawText, sourceType, title, originalContent)
  ├── 处理状态 (processStatus, processError)
  ├── 知识状态 (knowledgeStatus, reviewedAt, archivedAt)
  └── 时间戳 (createdAt, updatedAt)

EntryAIResult (AI 提取结果，1:1)
  ├── contentType, techDomain, aiTags
  ├── coreSummary, practiceValue
  ├── summaryStructure, keyPoints, boundaries, confidence
  └── extractedMetadata (新增：代码/链接/作者等)

EntryEvaluation (评估维度，1:1)
  ├── difficulty, contentForm, timeliness, sourceTrust
  └── qualityOverride

EntrySmartSummary (智能摘要，1:1，可选)
  ├── smartSummary, keyInsights, tldr
  └── generatedAt
```

迁移策略：
1. 创建新表 + 数据迁移脚本
2. 保留 Entry 旧字段为 deprecated（过渡期）
3. 前端/API 逐步切换到新表
4. 确认无引用后删除旧字段

### B2.2 Pipeline 工具系统启用（P5.1 + P5.2 + P5.3）

当前 builtin-tools.ts 定义了 7 个工具但未被 engine.ts 调用。

方案：重构 engine.ts，从硬编码两步流程改为工具驱动的 ReAct loop。

```
Phase 1: 最小启用
  - engine.ts 调用 classify_content 工具完成 Step 1
  - engine.ts 调用 extract_summary 工具完成 Step 2
  - 保持两步结构不变，但通过工具注册机制执行

Phase 2: 差异化路由
  - 启用 route-strategy.ts
  - 根据 contentType 选择不同的工具组合
  - TUTORIAL → classify + extract + extract_code
  - TOOL_RECOMMENDATION → classify + extract + extract_version
```

### B2.3 文档修正（D1.2 + D1.4 + D1.7）

- CLAUDE.md 目录结构：移除 `extractor.ts`，添加 `agent/` 子目录描述
- docs/README.md：补全 11 个 plan 文档索引 + architecture/ 展开
- SYSTEM_ARCHITECTURE.md：补充 agent/ 模块说明

### B2.4 前端用户操作增强（F2.3）

Entry 详情页增加：
- 编辑标题和用户标签（inline edit）
- 添加个人笔记（新增 `EntryNote` 模型）
- 状态操作按钮（确认/归档/标记过时）

### B2.5 Dashboard 行动导向（F2.4）

增加：
- "待审阅" 条目数量和快捷入口
- "本周新增" 趋势（简单折线）
- 按 knowledgeStatus 分布的饼图

### B2.6 内容截断优化（A3.3）

当前 Step 1 只取 12K 字符（头中尾采样），改为：
- 短内容（<12K）：全文传入
- 中等内容（12K-50K）：语义分段，取每段首尾
- 长内容（>50K）：先用轻量模型生成摘要，再传入 Agent

### B2.7 新增摘要结构类型（A3.4）

在现有 6 种基础上增加：
- `api-reference`：参数、返回值、示例代码
- `comparison-matrix`：多工具/方案横向对比
- `timeline-evolution`：技术演进、版本变化

---

## Batch 3: P2 优化（11 项）

| # | 项目 | 说明 |
|---|------|------|
| B3.1 | UI 组件完善（F2.5） | 全局 Toast、自定义 confirm、骨架屏 |
| B3.2 | 排序增强（F2.6） | 按难度、相关性、最近访问排序 |
| B3.3 | 批量导入（F2.7） | 支持多链接一次性导入 |
| B3.4 | 全局搜索（F2.8） | Navbar 增加搜索入口 |
| B3.5 | Prompt 整理（A3.5） | 删除未使用的 prompts.ts，统一到 engine.ts |
| B3.6 | Parser 元数据增强（A3.6） | 网页提取 author/date，GitHub 提取 stars/topics |
| B3.7 | JSON 字段类型安全（M4.3） | 为 Json 字段添加 Zod runtime 校验 |
| B3.8 | AI 结果版本化（M4.4） | EntryAIResult 支持多版本，可对比 |
| B3.9 | Parser 类型扩展（P5.4） | YouTube 字幕、Markdown 直接解析 |
| B3.10 | Plan 文档归档（G6.1） | 创建 docs/archive/，归档已完成 plan |
| B3.11 | operations 目录（G6.2） | 创建或从标准中移除 |

---

## 执行计划

| 批次 | 范围 | 预估会话数 | 前置依赖 |
|------|------|-----------|---------|
| Batch 1 | P0 修复（5 项） | 2-3 | 无 |
| Batch 2 | P1 改进（11 项） | 4-5 | Batch 1 中的数据模型变更 |
| Batch 3 | P2 优化（11 项） | 3-4 | Batch 2 中的模型拆分 |

Batch 1 建议执行顺序：
1. B1.1 CLAUDE.md 修正（快速，10 分钟）
2. B1.2 知识管理状态模型（数据模型 + API + 前端）
3. B1.3 Entry 详情页重构（前端）
4. B1.4 AI 信息提取增强（Agent prompt + schema）

---

*创建时间: 2026-02-25*
*状态: 待确认*
