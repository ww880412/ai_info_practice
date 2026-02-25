# ai_info_practice 项目进度记录

> 里程碑级状态索引。会话级交接细节记录在 `PROGRESS.log`。

## 📍 当前状态（2026-02-25）

### 活跃分支
- `main`（主线，Batch 2 已合并）

### 本次完成
- ✅ Batch 2 系统性升级（B2.1-B2.7），27 文件 +1936/-104 行
- ✅ Entry God Model 拆分为 4 个子表（EntryAIResult, EntryEvaluation, EntrySmartSummary, EntryNote）
- ✅ Pipeline 工具系统启用（classify/extract/code/version 工具）
- ✅ 前端用户操作增强（InlineEdit, TagEditor, NotePanel）
- ✅ Dashboard 行动导向（待审阅入口、状态分布、周趋势）
- ✅ 语义内容截断替代头中尾采样
- ✅ 3 种新摘要结构类型（api-reference, comparison-matrix, timeline-evolution）
- ✅ 文档修正（CLAUDE.md 目录结构、docs 索引、架构文档）
- ✅ 数据库 schema 已同步，19 条数据已迁移

---

## 阶段总览

| 阶段 | 状态 | 说明 |
|------|------|------|
| Phase 1: 基础架构 | ✅ 已完成 | Next.js + Prisma + Gemini API |
| Phase 2: AI 处理管道 | ✅ 已完成 | L1/L2/L3 处理流程 |
| Phase 3: 前端界面 | ✅ 已完成 | 知识库、练习队列、详情页 |
| Phase 4: 工程规范 | ✅ 已完成 | 协作文档、测试覆盖、架构文档 |

### 功能分支状态

| 方向 | 分支 | Phase 1 | Phase 2 | Phase 3 | Phase 4 | 状态 |
|------|------|---------|---------|---------|---------|------|
| 前端层级管理 | codex/frontend-hierarchy | ✅ 标签侧边栏 | ✅ 分组管理 | ✅ 智能排序 | ✅ Dashboard | ✅ 已合并 |
| Agent 透明化 | codex/agent-transparency | ✅ 元数据面板 | ✅ 质量评估 | ✅ 推理增强 | ✅ 处理日志 | ✅ 已合并 |
| 系统性升级 Batch 1 | codex/batch1-systematic-upgrade | ✅ 状态模型 | ✅ 提取增强 | ✅ 详情页重构 | ✅ 文档修正 | ✅ 已合并 |
| 系统性升级 Batch 2 | codex/batch2-systematic-upgrade | ✅ 模型拆分 | ✅ Pipeline 工具 | ✅ 前端增强 | ✅ 文档修正 | ✅ 已合并 |

---

## 📊 测试覆盖

| 模块 | 测试数 |
|------|--------|
| parser | 8 |
| ai/agent | 15 |
| gemini | 5 |
| ingest | 7 |
| entries | 2 |
| sanitize | 10 |
| deduplication | 7 |
| **总计** | **56** |

---

## 🔜 项目待办

- Batch 3 (P2): UI 组件、排序、批量导入、全局搜索、Prompt 整理、Parser 增强、版本化、文档归档

---

*最后更新: 2026-02-25*
