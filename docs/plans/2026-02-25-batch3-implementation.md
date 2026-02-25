# Batch 3 (P2 优化) 实施计划

> 基于 2026-02-25 系统性升级设计
> 项目路径: /Users/ww/Desktop/mycode/ai_info_practice
> 状态: 待执行 | 依赖: Batch 1 + Batch 2

## 概述

Batch 3 包含 11 个 P2 级别优化项，分三组：

- 前端组（B3.1-B3.4）：UI 组件完善、排序、批量导入、全局搜索
- 后端/AI 组（B3.5-B3.9）：Prompt 整理、Parser 增强、类型安全、版本化、Parser 扩展
- 文档组（B3.10-B3.11）：Plan 归档、operations 目录

---

## 第一部分：前端工作

### B3.1 UI 组件完善

#### 涉及文件
- `src/components/common/Toast.tsx`（新建）
- `src/components/common/ConfirmDialog.tsx`（新建）
- `src/components/common/Skeleton.tsx`（新建）
- `src/app/layout.tsx`（修改，挂载 Toast Provider）
- 所有使用 `alert()` / `confirm()` 的组件（替换）

#### 具体变更
1. Toast 系统：创建 ToastProvider + useToast hook，支持 success/error/info 类型，自动消失
2. ConfirmDialog：替换原生 confirm()，支持自定义标题、描述、确认/取消按钮
3. Skeleton：创建通用骨架屏组件，应用到 Dashboard、Practice、Entry 详情页

#### 变更顺序
1. Toast 组件 + Provider → 挂载到 layout.tsx
2. ConfirmDialog 组件
3. Skeleton 组件
4. 逐个替换现有 alert/confirm 调用

#### 验收标准
- Toast 通知在操作成功/失败时显示
- 删除操作使用自定义确认对话框
- 所有页面有骨架屏加载状态

#### 依赖
- 无 Batch 1/2 依赖

---

### B3.2 排序增强

#### 涉及文件
- `src/app/api/entries/route.ts`（修改 GET，支持更多排序字段）
- `src/hooks/useEntries.ts`（修改，添加 sortBy 参数）
- `src/app/library/LibraryPageClient.tsx`（修改，添加排序 UI）

#### 具体变更
1. API 层：GET /api/entries 支持 sortBy 参数（createdAt, difficulty, updatedAt, confidence）
2. Hook 层：useEntries 传递 sortBy 参数
3. 前端：Library 页面添加排序下拉菜单

#### 验收标准
- 可按创建时间、难度、更新时间、置信度排序
- 排序状态在 URL 参数中持久化

#### 依赖
- 依赖 Batch 2 B2.1（如果 difficulty 字段迁移到 EntryEvaluation 表）

---

### B3.3 批量导入

#### 涉及文件
- `src/components/ingest/IngestDialog.tsx`（修改）
- `src/app/api/ingest/route.ts`（修改，支持批量）
- `src/hooks/useIngest.ts`（修改）

#### 具体变更
1. IngestDialog：Link 模式支持多行输入（textarea），每行一个 URL
2. API：POST /api/ingest 支持 `urls: string[]` 参数，循环创建 Entry
3. Hook：useIngest 支持批量提交，返回每个 URL 的处理状态

#### 验收标准
- 可一次性输入多个 URL（最多 10 个）
- 每个 URL 独立处理，显示各自状态
- 部分失败不影响其他 URL

#### 依赖
- 无 Batch 1/2 依赖

---

### B3.4 全局搜索

#### 涉及文件
- `src/components/common/Navbar.tsx`（修改，添加搜索入口）
- `src/components/common/SearchDialog.tsx`（新建）
- `src/app/api/entries/search/route.ts`（新建，全文搜索 API）

#### 具体变更
1. Navbar：添加搜索图标按钮，点击打开搜索对话框
2. SearchDialog：全屏搜索对话框，支持键盘快捷键（Cmd+K），实时搜索，显示结果列表
3. API：GET /api/entries/search?q=keyword，搜索 title + coreSummary + aiTags

#### 验收标准
- Cmd+K 打开全局搜索
- 输入关键词实时显示匹配结果
- 点击结果跳转到 Entry 详情页

#### 依赖
- 无 Batch 1/2 依赖

---

## 第二部分：后端/AI 工作

### B3.5 Prompt 整理

#### 涉及文件
- `src/lib/ai/prompts.ts`（删除或标记废弃）
- `src/lib/ai/agent/engine.ts`（确认为唯一 prompt 来源）

#### 具体变更
1. 确认 prompts.ts 中的函数无任何引用
2. 删除 prompts.ts 或将其内容迁移到 engine.ts 的注释中作为历史参考
3. 在 engine.ts 中添加注释说明 prompt 管理策略

#### 验收标准
- 项目中只有一处 prompt 定义（engine.ts）
- 无 dead code

#### 依赖
- 无

---

### B3.6 Parser 元数据增强

#### 涉及文件
- `src/lib/parser/webpage.ts`（修改）
- `src/lib/parser/github.ts`（修改）
- `src/lib/parser/types.ts`（修改，扩展 ParseResult）

#### 具体变更
1. ParseResult 接口新增 metadata 字段：`{ author?, publishDate?, keywords?, stars?, topics?, language? }`
2. webpage.ts：使用 cheerio 提取 meta 标签（og:author, article:published_time, keywords）
3. github.ts：通过 GitHub API 提取 repo 的 stars, topics, primary language

#### 验收标准
- 网页解析结果包含 author 和 publishDate（如果页面有 meta 标签）
- GitHub 解析结果包含 stars 和 topics

#### 依赖
- 依赖 Batch 1 B1.4（extractedMetadata 字段存储 parser 提取的元数据）

---

### B3.7 JSON 字段类型安全

#### 涉及文件
- `src/lib/ai/agent/schemas.ts`（扩展，为所有 Json 字段定义 Zod schema）
- `src/app/api/entries/route.ts`（修改，添加 runtime 校验）
- `src/app/api/entries/[id]/route.ts`（修改）

#### 具体变更
1. schemas.ts 新增：summaryStructureSchema, keyPointsNewSchema, boundariesSchema, qualityOverrideSchema
2. API 层：在写入 Json 字段前用 Zod parse 校验
3. 读取时用 safeParse 处理历史脏数据

#### 验收标准
- 所有 Json 字段写入前经过 Zod 校验
- 非法数据被拒绝并返回明确错误信息
- 历史数据读取不报错（safeParse）

#### 依赖
- 依赖 Batch 2 B2.1（如果 Json 字段迁移到新表）

---

### B3.8 AI 结果版本化

#### 涉及文件
- `prisma/schema.prisma`（修改，EntryAIResult 支持版本）
- `src/app/api/entries/[id]/ai-results/route.ts`（新建）

#### 具体变更
1. EntryAIResult 新增 version 字段和 isActive 标记
2. 每次 AI 重新处理创建新版本，旧版本 isActive = false
3. API：GET /api/entries/[id]/ai-results 返回所有版本

#### 验收标准
- 重新处理条目时保留历史 AI 结果
- 可查看和对比不同版本的提取结果

#### 依赖
- 强依赖 Batch 2 B2.1（EntryAIResult 表必须先创建）

---

### B3.9 Parser 类型扩展

#### 涉及文件
- `src/lib/parser/youtube.ts`（新建）
- `src/lib/parser/markdown.ts`（新建）
- `src/lib/parser/index.ts`（修改，注册新 parser）

#### 具体变更
1. YouTube parser：通过 YouTube Data API 或 yt-dlp 提取字幕文本
2. Markdown parser：直接解析 .md 文件，保留结构
3. 注册到 parser registry

#### 验收标准
- YouTube 链接可正常入库并提取字幕内容
- Markdown 文件可正常入库

#### 依赖
- 无 Batch 1/2 依赖

---

## 第三部分：文档工作

### B3.10 Plan 文档归档

#### 涉及文件
- `docs/archive/2026-Q1/`（新建目录）
- `docs/plans/` 下已完成的文档（移动）
- `docs/README.md`（更新索引）

#### 具体变更
1. 创建 docs/archive/2026-Q1/ 目录
2. 移动已完成的 plan 文档：
   - 2026-02-21-phase1-implementation.md
   - 2026-02-21-knowledge-agent-implementation.md
   - 2026-02-23-agent-transparency-plan.md
   - 2026-02-23-frontend-hierarchy-plan.md
   - 2026-02-22-library-batch-delete.md
3. 保留在 plans/ 中的：
   - 2026-02-21-iteration-design.md（核心设计参考）
   - 2026-02-21-knowledge-agent-design.md（架构参考）
   - 2026-02-22-knowledge-system-whitepaper.md（长期参考）
   - 2026-02-24-library-layout-modules-design.md（最新）
   - 2026-02-25-* 系列（当前升级计划）
4. 更新 docs/README.md 索引

#### 验收标准
- archive/ 目录存在且包含已完成文档
- plans/ 只保留活跃和参考文档
- README.md 索引完整准确

#### 依赖
- 无

---

### B3.11 operations 目录

#### 涉及文件
- `docs/DOCUMENTATION_STANDARDS.md`（修改）

#### 具体变更
- 方案 A：创建 docs/operations/ 并放入 Docker 部署指南
- 方案 B：从 DOCUMENTATION_STANDARDS.md 中移除 operations/ 的引用

建议选择方案 B（当前无运维文档需求，避免空目录）。

#### 验收标准
- 文档标准与实际目录结构一致

#### 依赖
- 无

---

## 执行顺序建议

```
独立可并行：
  B3.1 UI 组件完善
  B3.3 批量导入
  B3.4 全局搜索
  B3.5 Prompt 整理
  B3.9 Parser 类型扩展
  B3.10 Plan 文档归档
  B3.11 operations 目录

依赖 Batch 1：
  B3.6 Parser 元数据增强（依赖 B1.4）

依赖 Batch 2：
  B3.2 排序增强（依赖 B2.1）
  B3.7 JSON 字段类型安全（依赖 B2.1）
  B3.8 AI 结果版本化（强依赖 B2.1）
```

---

*创建时间: 2026-02-25*
*状态: 待执行*
