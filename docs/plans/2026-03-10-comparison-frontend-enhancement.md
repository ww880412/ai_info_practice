# Mode Comparison 前端增强方案

> **文档类型**: 设计方案
> **创建时间**: 2026-03-10
> **状态**: 待确认
> **相关文档**: [mode-comparison-e2e-analysis.md](../analysis/mode-comparison-e2e-analysis.md)

---

## 一、问题定义

### 1.1 当前问题

根据 E2E 分析文档，当前 mode-comparison 功能存在以下问题：

1. **Tooling 模式信息量更大**（14个标签 vs 10个，11个结构字段 vs 6个）
2. **前端没有充分展示 Tooling 的丰富信息**（来源可信度、时效性、完整性、难度等级等字段未展示）
3. **对比页面信息量不足**，用户难以直观对比两种模式的差异
4. **用户感觉 Tooling 模式"不如" Two-Step 体系化**，但实际上是前端展示问题

### 1.2 根本原因

- **缺少统一的对比维度定义**：两种模式输出结构差异大，前端难以统一展示
- **前端渲染逻辑单一**：没有针对不同模式的差异化渲染策略
- **对比页面设计不足**：没有充分利用已有的评分系统和丰富信息

---

## 二、预期目标

### 2.1 用户体验目标

1. **清晰的对比视图**：用户能一眼看出两种模式在各个维度上的差异
2. **充分的信息展示**：Tooling 模式的元数据（来源可信度、时效性等）得到展示
3. **差异化的结构渲染**：Two-Step 的演进链路和 Tooling 的叙事结构都能清晰呈现
4. **量化的质量评估**：通过 Scoring Agent 的评分，客观对比两种模式的质量

### 2.2 技术目标

1. **定义固定的对比维度**：7 个核心维度，便于前端统一展示
2. **保持结构灵活性**：每个维度内部结构可以不同，发挥各模式优势
3. **实现动态渲染**：前端根据模式类型选择合适的渲染器
4. **向后兼容**：不影响现有的 Entry 详情页展示

### 2.3 成功标准

- ✅ 用户能在对比页面看到 7 个维度的并排对比
- ✅ Tooling 模式的元数据字段得到展示
- ✅ Two-Step 的演进链路（initialApproach → finalChoice）可视化
- ✅ Tooling 的叙事结构（focus + details）清晰呈现
- ✅ 评分结果在对比页面中突出展示

---

## 三、技术方案

### 3.1 架构设计

采用**混合策略**：
- **固定维度**：定义 7 个对比维度作为契约
- **灵活结构**：维度内部结构保持灵活，由各模式自己定义
- **动态渲染**：前端根据 `mode` 字段选择渲染器

```
┌─────────────────────────────────────────────────────────┐
│                   Comparison Contract                    │
│  (7个固定维度：分类、摘要、要点、结构、边界、元数据、执行)  │
└─────────────────────────────────────────────────────────┘
                            │
                ┌───────────┴───────────┐
                │                       │
        ┌───────▼──────┐        ┌──────▼───────┐
        │  Two-Step    │        │   Tooling    │
        │  Structure   │        │  Structure   │
        │  (6 fields)  │        │  (11 fields) │
        └───────┬──────┘        └──────┬───────┘
                │                       │
        ┌───────▼──────┐        ┌──────▼───────┐
        │  Two-Step    │        │   Tooling    │
        │  Renderer    │        │  Renderer    │
        └──────────────┘        └──────────────┘
```

### 3.2 对比维度定义

#### 维度 1: 基础分类
- contentType（内容类型）
- techDomain（技术领域）
- aiTags（AI 标签，数量可能不同）
- confidence（置信度）

#### 维度 2: 核心摘要
- coreSummary（核心摘要文本）
- wordCount（字数统计）

#### 维度 3: 关键要点
- core（核心要点，数量可能不同）
- extended（扩展要点，数量可能不同）
- totalCount（总数统计）

#### 维度 4: 结构化内容（灵活）
- type（结构类型，如 timeline-evolution）
- stageCount（阶段数量）
- content（内部结构，Two-Step 和 Tooling 不同）
  - Two-Step: initialApproach → problem → iteration → result → finalChoice
  - Tooling: focus + details（叙事结构）

#### 维度 5: 边界定义
- applicable（适用场景）
- notApplicable（不适用场景）

#### 维度 6: 元数据（可选）
- sourceCredibility（来源可信度，Tooling 独有）
- timeliness（时效性，Tooling 独有）
- completeness（完整性，Tooling 独有）
- difficultyLevel（难度等级，Tooling 独有）

#### 维度 7: 执行信息
- mode（模式类型）
- duration（执行时长）
- stepCount（推理步骤数）
- toolCallCount（工具调用次数）

### 3.3 数据流设计

```typescript
// 1. 后端：确保两种模式都输出对比维度
ComparisonBatch
  ↓
process-comparison-batch.ts
  ↓
extractComparisonDimensions(entry) → ComparisonDimensions
  ↓
存储到 ComparisonResult 表

// 2. 前端：读取对比维度并渲染
ComparisonResult
  ↓
ComparisonView 组件
  ↓
7 个 DimensionCard 组件
  ↓
动态选择渲染器（TwoStepRenderer / ToolingRenderer）
```

### 3.4 前端组件设计

#### 3.4.1 页面结构
```
ComparisonView
├── ComparisonHeader（模式信息、执行时长、置信度）
├── ComparisonStats（7个维度的统计对比）
├── DimensionCard: 基础分类
│   └── ClassificationComparison（并排展示）
├── DimensionCard: 核心摘要
│   └── SummaryComparison（并排展示）
├── DimensionCard: 关键要点
│   └── KeyPointsComparison（并排展示）
├── DimensionCard: 结构化内容
│   ├── TwoStepStructureRenderer（左侧）
│   └── ToolingStructureRenderer（右侧）
├── DimensionCard: 边界定义
│   └── BoundariesComparison（并排展示）
├── DimensionCard: 元数据（如果有）
│   └── MetadataComparison（展示 Tooling 独有字段）
└── DimensionCard: 质量评分
    └── ScoreComparison（5维度评分对比）
```

#### 3.4.2 关键组件

**ComparisonStats（统计面板）**
- 执行时间对比
- 标签数量对比
- 要点数量对比
- 演进阶段数量对比
- 置信度对比
- 元数据丰富度对比

**StructureComparison（结构对比，核心）**
- 左右分栏布局
- 左侧：TwoStepStructureRenderer
  - 展示演进链路：initialApproach → problem → iteration → result → finalChoice
  - 可视化为流程图或时间线
- 右侧：ToolingStructureRenderer
  - 展示叙事结构：focus + details
  - 展示更丰富的字段（currentStatus.evidence, futureOutlook.openQuestions）

**ScoreComparison（评分对比）**
- 5 维度雷达图对比
- 总分对比
- issues 和 suggestions 对比展示

### 3.5 技术实现细节

#### 3.5.1 后端改动

**文件**: `src/lib/ai/agent/comparison-contract.ts`（新建）
- 定义 `ComparisonDimensions` 接口
- 定义 `TwoStepStructure` 和 `ToolingStructure` 接口
- 导出类型定义

**文件**: `src/lib/inngest/functions/process-comparison-batch.ts`（修改）
- 增加 `extractComparisonDimensions()` 函数
- 确保两种模式都输出对比维度
- 将对比维度存储到 `ComparisonResult` 表

**文件**: `prisma/schema.prisma`（可能需要修改）
- 检查 `ComparisonResult` 表是否需要增加字段
- 如果需要，增加 `comparisonDimensions` JSON 字段

#### 3.5.2 前端改动

**文件**: `src/components/comparison/ComparisonView.tsx`（新建）
- 主对比页面组件
- 调用 7 个维度的子组件

**文件**: `src/components/comparison/DimensionCard.tsx`（新建）
- 维度卡片容器组件
- 统一的样式和布局

**文件**: `src/components/comparison/ClassificationComparison.tsx`（新建）
- 基础分类对比组件

**文件**: `src/components/comparison/SummaryComparison.tsx`（新建）
- 核心摘要对比组件

**文件**: `src/components/comparison/KeyPointsComparison.tsx`（新建）
- 关键要点对比组件

**文件**: `src/components/comparison/StructureComparison.tsx`（新建）
- 结构化内容对比组件（核心）
- 包含 `TwoStepStructureRenderer` 和 `ToolingStructureRenderer`

**文件**: `src/components/comparison/BoundariesComparison.tsx`（新建）
- 边界定义对比组件

**文件**: `src/components/comparison/MetadataComparison.tsx`（新建）
- 元数据对比组件

**文件**: `src/components/comparison/ScoreComparison.tsx`（新建）
- 质量评分对比组件
- 包含雷达图可视化

**文件**: `src/components/comparison/ComparisonStats.tsx`（新建）
- 统计面板组件

---

## 四、实施计划

### Phase 1: 后端契约定义（预计 2-3h）

**目标**: 定义对比维度契约，确保两种模式都输出这些维度

**任务**:
1. 创建 `src/lib/ai/agent/comparison-contract.ts`
   - 定义 `ComparisonDimensions` 接口
   - 定义 `TwoStepStructure` 和 `ToolingStructure` 接口
   - 导出类型定义

2. 修改 `src/lib/inngest/functions/process-comparison-batch.ts`
   - 增加 `extractComparisonDimensions()` 函数
   - 从 Entry 中提取对比维度
   - 将对比维度存储到 ComparisonResult

3. 检查 Prisma Schema
   - 确认 `ComparisonResult` 表是否需要增加字段
   - 如果需要，运行 migration

4. 单元测试
   - 测试 `extractComparisonDimensions()` 函数
   - 确保两种模式都能正确提取维度

**验收标准**:
- ✅ `ComparisonDimensions` 接口定义完整
- ✅ `extractComparisonDimensions()` 函数通过测试
- ✅ ComparisonResult 表包含对比维度数据

---

### Phase 2: 前端基础组件（预计 3-4h）

**目标**: 创建对比页面的基础组件和布局

**任务**:
1. 创建 `src/components/comparison/` 目录

2. 创建基础组件
   - `DimensionCard.tsx`（维度卡片容器）
   - `ComparisonStats.tsx`（统计面板）
   - `ComparisonHeader.tsx`（页面头部）

3. 创建简单对比组件
   - `ClassificationComparison.tsx`（基础分类）
   - `SummaryComparison.tsx`（核心摘要）
   - `KeyPointsComparison.tsx`（关键要点）
   - `BoundariesComparison.tsx`（边界定义）

4. 创建主页面组件
   - `ComparisonView.tsx`（整合所有子组件）

5. 路由配置
   - 修改 `src/app/comparison/[id]/page.tsx`
   - 使用新的 `ComparisonView` 组件

**验收标准**:
- ✅ 对比页面能正常访问
- ✅ 基础信息（分类、摘要、要点、边界）能并排展示
- ✅ 统计面板能展示数量对比

---

### Phase 3: 结构化内容动态渲染（预计 4-5h）

**目标**: 实现维度 4（结构化内容）的差异化渲染

**任务**:
1. 创建 `StructureComparison.tsx`
   - 左右分栏布局
   - 根据模式类型选择渲染器

2. 创建 `TwoStepStructureRenderer.tsx`
   - 展示演进链路（initialApproach → finalChoice）
   - 实现时间线或流程图可视化
   - 展示 6 个核心字段

3. 创建 `ToolingStructureRenderer.tsx`
   - 展示叙事结构（focus + details）
   - 展示 11 个字段（包含元数据）
   - 突出 Tooling 独有的丰富信息

4. 样式优化
   - 统一两种渲染器的视觉风格
   - 高亮差异点
   - 响应式布局

**验收标准**:
- ✅ Two-Step 的演进链路清晰可见
- ✅ Tooling 的叙事结构和元数据得到展示
- ✅ 两种结构在视觉上易于对比

---

### Phase 4: 元数据和评分展示（预计 2-3h）

**目标**: 展示 Tooling 独有的元数据和质量评分对比

**任务**:
1. 创建 `MetadataComparison.tsx`
   - 展示来源可信度、时效性、完整性、难度等级
   - 只在 Tooling 模式有数据时展示

2. 创建 `ScoreComparison.tsx`
   - 展示 5 维度评分对比
   - 实现雷达图可视化（使用 recharts 或 chart.js）
   - 展示总分对比
   - 展示 issues 和 suggestions

3. 集成到主页面
   - 在 `ComparisonView` 中增加这两个组件
   - 调整布局顺序

**验收标准**:
- ✅ Tooling 的元数据字段得到展示
- ✅ 评分雷达图清晰易读
- ✅ issues 和 suggestions 并排对比

---

### Phase 5: 优化和测试（预计 2-3h）

**目标**: 优化用户体验，确保功能稳定

**任务**:
1. 视觉优化
   - 统一配色方案
   - 增加图标和视觉提示
   - 优化间距和排版

2. 交互优化
   - 增加折叠/展开功能（对于长内容）
   - 增加复制功能（复制对比结果）
   - 增加导出功能（导出为 Markdown 或 PDF）

3. 测试
   - 测试不同内容类型的对比展示
   - 测试边界情况（缺少某些字段）
   - 测试响应式布局

4. 文档更新
   - 更新用户指南
   - 增加对比页面的使用说明

**验收标准**:
- ✅ 对比页面在不同屏幕尺寸下都能正常展示
- ✅ 边界情况处理正确（不会崩溃）
- ✅ 用户指南包含对比功能说明

---

## 五、风险和挑战

### 5.1 技术风险

**风险 1: 两种模式的输出结构差异过大**
- **影响**: 难以提取统一的对比维度
- **缓解**: 在 Phase 1 中先验证现有数据，确认可行性
- **应对**: 如果差异过大，考虑增加后处理标准化层

**风险 2: 前端动态渲染复杂度高**
- **影响**: 代码难以维护，容易出 bug
- **缓解**: 使用 TypeScript 严格类型检查，增加单元测试
- **应对**: 如果过于复杂，考虑简化渲染逻辑

**风险 3: 性能问题**
- **影响**: 对比页面加载慢，用户体验差
- **缓解**: 使用 React.memo 优化渲染，懒加载大组件
- **应对**: 如果性能不足，考虑服务端渲染或分页加载

### 5.2 产品风险

**风险 1: 用户不理解对比维度**
- **影响**: 用户看不懂对比结果，功能价值降低
- **缓解**: 增加说明文案和工具提示
- **应对**: 收集用户反馈，迭代优化展示方式

**风险 2: 对比结果不符合预期**
- **影响**: 用户发现对比结果与实际体验不符
- **缓解**: 在 Phase 5 中充分测试，确保准确性
- **应对**: 增加用户反馈机制，持续改进

---

## 六、后续优化方向

### 6.1 短期优化（1-2周）

1. **增加更多可视化**
   - 标签云对比
   - 要点重要性热力图
   - 演进阶段时间线图

2. **增加交互功能**
   - 点击标签查看详情
   - 点击要点展开完整内容
   - 点击阶段查看演进细节

3. **增加导出功能**
   - 导出为 Markdown
   - 导出为 PDF
   - 导出为图片

### 6.2 中期优化（1个月）

1. **批量对比**
   - 支持对比多个 Entry
   - 生成对比报告
   - 识别模式优劣势

2. **智能推荐**
   - 根据内容类型推荐模式
   - 根据历史数据推荐模式
   - 自动选择最优模式

3. **A/B 测试**
   - 收集用户偏好数据
   - 分析模式选择规律
   - 优化推荐算法

### 6.3 长期优化（3个月+）

1. **混合模式**
   - 结合两种模式的优势
   - 自动选择最优策略
   - 动态调整推理流程

2. **自适应渲染**
   - 根据内容类型选择渲染方式
   - 根据用户偏好调整展示
   - 个性化对比视图

3. **质量预测**
   - 在处理前预测质量
   - 推荐最优模式
   - 减少无效对比

---

## 七、总结

### 7.1 核心价值

1. **充分展示 Tooling 模式的优势**：元数据、更多标签、更完整的演进阶段
2. **清晰对比两种模式的差异**：7 个维度并排展示，一目了然
3. **保持各模式的特色**：差异化渲染，发挥各自优势
4. **量化质量评估**：通过 Scoring Agent 的评分，客观对比

### 7.2 关键决策

- ✅ **决策 1**: 采用混合策略（固定维度 + 灵活结构 + 动态渲染）
- ✅ **决策 2**: 使用 Scoring Agent 的评分，不需要"赢家标注"

### 7.3 实施时间估算

- Phase 1: 2-3h（后端契约定义）
- Phase 2: 3-4h（前端基础组件）
- Phase 3: 4-5h（结构化内容动态渲染）
- Phase 4: 2-3h（元数据和评分展示）
- Phase 5: 2-3h（优化和测试）

**总计**: 13-18h（约 2-3 个工作日）

---

## 八、待确认事项

1. ✅ 对比维度定义是否完整？是否需要增加或删除某些维度？
2. ✅ 前端组件设计是否合理？是否需要调整布局或交互方式？
3. ✅ 实施计划的优先级是否正确？是否需要调整 Phase 顺序？
4. ✅ 时间估算是否合理？是否需要调整资源分配？
5. ✅ 是否有其他需要考虑的风险或挑战？

---

**下一步**: 等待用户确认后，进入实施阶段。
