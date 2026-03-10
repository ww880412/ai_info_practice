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
- **6 个对比维度**: 详细展示决策内容的各个方面
- **并排展示**: 原始模式和对比模式的决策详情
- **响应式布局**: 支持桌面端和移动端查看

#### 6 个对比维度

1. **维度 1：基础分类**
   - 内容类型 (contentType)
   - 技术领域 (techDomain)
   - AI 标签 (aiTags)
   - 置信度 (confidence)

2. **维度 2：核心摘要**
   - 核心摘要文本 (coreSummary)
   - 字符数统计
   - 中英文自动识别

3. **维度 3：关键要点**
   - 核心要点 (core)
   - 扩展要点 (extended)
   - 列表形式展示

4. **维度 4：结构化内容**
   - 动态渲染不同类型的结构
   - 支持 two-step 时间线
   - 支持 tooling 时间线
   - 未知类型自动降级为键值对展示

5. **维度 5：边界定义**
   - 适用场景 (applicable) - 绿色标记
   - 不适用场景 (notApplicable) - 红色标记
   - 列表形式展示

6. **维度 6：元数据**
   - 难度 (difficulty)
   - 来源可信度 (sourceTrust)
   - 时效性 (timeliness)
   - 内容形式 (contentForm)

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

## 实现细节

### 前端组件
- **useComparisonBatch Hook**: TanStack Query 集成，自动轮询
- **CompareModesDialog**: 模式选择弹窗
- **BatchStats**: 统计卡片组件
- **ComparisonList**: 结果列表组件
- **6 个维度卡片**: ClassificationCard, SummaryCard, KeyPointsCard, BoundariesCard, MetadataCard, StructureCard
- **结构化渲染器**: TwoStepTimelineRenderer, ToolingTimelineRenderer, GenericStructureRenderer
- **规范化层**: normalize.ts 统一数据格式，处理新旧字段兼容

### 后端实现
- **Prisma Schema**: ModeComparison + ComparisonBatch 表
- **API Routes**: 创建批次、查询状态
- **Inngest 函数**: 异步批量处理
- **评分 Agent**: 5 维度质量评估

### 测试覆盖
- 单元测试: 136 个测试全部通过
- E2E 测试: 6 个场景覆盖完整流程
- Codex 评审: 后端 8.9/10 分

---

**文档版本**: v2.0
**最后更新**: 2026-03-10
**作者**: Claude (Sonnet 4.6)
**更新内容**:
- 新增 6 个对比维度详细说明
- 新增结构化内容动态渲染说明
- 新增响应式布局支持
- 更新前端组件列表
