# Mode Comparison Frontend - Task 12: 文档与清理

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 更新项目文档，清理调试代码，完成最终验收

**Architecture:** 更新 PROGRESS.md、创建使用指南、清理临时代码

**Tech Stack:** Markdown, Git

---

## Task 12: 文档与清理

### Step 1: 更新 PROGRESS.md

**Files:**
- Modify: `PROGRESS.md`

更新项目进度：

```markdown
### 最近完成
- ✅ CRS Provider SSE 流式响应支持（修复集成问题）
- ✅ Agent 模式对比功能（完整实现，前后端）
  - ✅ 后端：Prisma Schema + API Routes + Inngest 任务（Codex Round 6 评审，8.9/10）
  - ✅ 前端：批量选择 + 对比弹窗 + 结果页面 + 详情页面
  - ✅ E2E 测试：6 个测试场景，覆盖完整流程
- ✅ Phase 3a: 结果评分 Agent（经 3 轮 Codex 评审，9/10 分）
```

### Step 2: 创建使用指南

**Files:**
- Create: `docs/guides/mode-comparison-guide.md`

创建用户使用指南：

```markdown
# Agent 模式对比功能使用指南

## 功能概述

模式对比功能允许你批量选择 Entry，使用不同的 Agent 模式（two-step vs tool-calling）重新处理，并通过评分 Agent 对比输出质量。

## 使用流程

### 1. 批量选择 Entry

1. 进入 Library 页面
2. 点击右上角"批量选择"按钮
3. 选择要对比的 Entry（支持单选、全选、清空）
4. 已选择的 Entry 会高亮显示

### 2. 启动模式对比

1. 点击"模式对比"按钮
2. 在弹窗中选择目标模式：
   - **两步模式 (Two-Step)**: 先快速分类，再深度分析。适合结构化内容。
   - **工具调用模式 (Tool-Calling)**: 使用内置工具增强分析能力。适合复杂内容。
3. 点击"开始对比"

### 3. 查看对比结果

系统会自动跳转到对比结果页面，显示：

- **处理进度**: 实时显示处理进度（自动刷新）
- **统计概览**: 胜率、平均分差、维度提升
- **结果列表**: 每个 Entry 的对比结果

### 4. 查看详细对比

点击任意结果卡片，进入详细对比页面：

- **评分对比**: 总体评分和 5 个维度的对比
- **并排展示**: 原始模式和对比模式的决策详情
- **差异高亮**: 清晰展示两种模式的差异

## 功能特性

### 批量操作
- 支持批量选择多个 Entry
- 支持全选和清空
- 退出选择模式自动清空选择

### 异步处理
- 后台队列处理，不阻塞 UI
- 实时进度更新（每 2 秒刷新）
- 处理完成自动停止轮询

### 质量评分
- 使用评分 Agent 对两份结果打分
- 5 个维度：完整性、准确性、相关性、清晰度、可操作性
- 自动判断胜者（分差 > 5 为显著差异）

### 统计分析
- 胜率统计（原始模式 vs 对比模式）
- 平均分差
- 维度级别的提升分析

## 技术细节

### 对比逻辑
- 读取 Entry 的原始 ParseResult
- 使用目标模式重新处理
- 并行调用评分 Agent 对两份结果打分
- 计算分差并判断胜者

### 评分标准
- **分差 > 5**: 对比模式胜出
- **分差 < -5**: 原始模式胜出
- **-5 ≤ 分差 ≤ 5**: 平局

### 数据持久化
- 对比结果保存到 ModeComparison 表
- 批次信息保存到 ComparisonBatch 表
- 支持历史对比记录查询

## 常见问题

### Q: 为什么有些 Entry 无法对比？
A: 只有通过 Agent 处理的 Entry 才能对比。如果 Entry 缺少 `originalExecutionMode` 字段，系统会拒绝对比。

### Q: 对比需要多长时间？
A: 大约每个 Entry 需要 30 秒。系统会显示预计处理时间。

### Q: 可以重复对比吗？
A: 可以。每次对比都会创建新的批次记录，不会覆盖历史记录。

### Q: 对比失败怎么办？
A: 系统会显示失败状态。可以查看 Inngest 日志了解详细错误信息。

## API 参考

### 创建对比批次
```
POST /api/entries/compare-modes
Body: { entryIds: string[], targetMode: 'two-step' | 'tool-calling' }
Response: { data: { batchId, entryCount, estimatedTime } }
```

### 查询批次状态
```
GET /api/entries/compare-modes/:batchId
Response: { data: { batchId, status, progress, results, stats } }
```

### 查询详细对比
```
GET /api/entries/compare-modes/:batchId/results/:entryId
Response: { data: { originalDecision, comparisonDecision, originalScore, comparisonScore, winner, scoreDiff } }
```

---

**文档版本**: v1.0
**最后更新**: 2026-03-08
```

### Step 3: 清理调试代码

检查并清理以下内容：

1. **Console.log 语句**: 移除所有调试用的 console.log
2. **注释代码**: 移除被注释掉的旧代码
3. **TODO 注释**: 确认所有 TODO 已完成或移除
4. **未使用的导入**: 移除未使用的 import 语句

Run: `npx eslint src --fix`

### Step 4: 运行完整测试套件

Run all tests to ensure everything works:

```bash
# Unit tests
npm test

# E2E tests
npx playwright test

# Type check
npx tsc --noEmit

# Lint
npm run lint
```

Expected: All tests passing, no type errors, no lint errors

### Step 5: 更新 README（如果需要）

**Files:**
- Modify: `README.md` (if exists)

添加模式对比功能说明到 README。

### Step 6: 最终验收

验收清单：

- [ ] 所有单元测试通过
- [ ] 所有 E2E 测试通过
- [ ] TypeScript 类型检查通过
- [ ] ESLint 检查通过
- [ ] PROGRESS.md 已更新
- [ ] 使用指南已创建
- [ ] 调试代码已清理
- [ ] 所有 TODO 已处理
- [ ] 文档已更新

### Step 7: 最终提交

```bash
git add .
git commit -m "docs: complete mode-comparison feature documentation and cleanup

- Update PROGRESS.md with feature completion status
- Add comprehensive user guide (docs/guides/mode-comparison-guide.md)
- Clean up debug code and unused imports
- Verify all tests passing
- Feature complete and production ready

Feature Summary:
- Backend: Prisma + API + Inngest (Codex 8.9/10)
- Frontend: Batch selection + Dialog + Results + Detail
- E2E Tests: 6 scenarios covering full flow
- Documentation: User guide + API reference

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## 验收清单

- [ ] PROGRESS.md 已更新
- [ ] 使用指南已创建
- [ ] 调试代码已清理
- [ ] 所有测试通过
- [ ] 类型检查通过
- [ ] Lint 检查通过
- [ ] 文档完整
- [ ] 代码已提交到 Git

---

**任务创建日期**: 2026-03-08
**预计工时**: 1-1.5 小时
**前置任务**: Task 7-11（所有实现任务）
