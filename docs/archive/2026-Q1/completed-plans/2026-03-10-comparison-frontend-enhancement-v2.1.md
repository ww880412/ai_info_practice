# Mode Comparison 前端增强方案 v2.1

> **文档类型**: 设计方案（基于 Codex 评审修订）
> **创建时间**: 2026-03-10
> **状态**: Codex 评审通过，待用户确认
> **版本历史**:
> - v2.0: 初始方案（基于现状迭代）
> - v2.1: 根据 Codex Layer 1 评审反馈修订
> **相关文档**:
> - [mode-comparison-e2e-analysis.md](../analysis/mode-comparison-e2e-analysis.md)
> - [mode-comparison-scoring-issues.md](../analysis/mode-comparison-scoring-issues.md)

---

## 变更摘要 (v2.0 → v2.1)

### Codex 评审结果
- **评分**: 7/10
- **判定**: REVISE → **已修订**
- **主要问题**: 缺少运行时验证、空值安全、数据规范化

### 核心改进
1. ✅ 新增 Phase 0: 数据审计（0.5h）
2. ✅ 新增 `normalizeDecision()` 工具函数（空值安全 + keyPoints 回退）
3. ✅ 新增 `GenericStructureRenderer`（兜底渲染器）
4. ✅ 所有卡片增加空状态处理（软失败）
5. ✅ 工具函数类型安全改进（移除 `any`）
6. ✅ 时间估算调整：10-13h → **12-14h**

---

## 一、现状分析

### 1.1 已有功能

**数据层**：
- ✅ `ModeComparison` 表已存储完整对比数据
  - `originalMode`: String（'two-step' | 'tool-calling'）
  - `comparisonMode`: String（'two-step' | 'tool-calling'）
  - `originalDecision`: `NormalizedAgentIngestDecision`（JSON）
  - `comparisonDecision`: `NormalizedAgentIngestDecision`（JSON）
  - `originalScore`: `QualityEvaluation`（JSON）
  - `comparisonScore`: `QualityEvaluation`（JSON）
  - `winner` / `scoreDiff`

- ✅ `NormalizedAgentIngestDecision` 包含完整信息：
  ```typescript
  {
    contentType, techDomain, aiTags,           // 基础分类
    coreSummary, keyPoints, keyPointsNew,      // 核心内容（双写）
    summaryStructure,                          // 结构化摘要
    boundaries,                                // 边界定义
    confidence,                                // 置信度
    difficulty, sourceTrust, timeliness,       // 元数据
    contentForm, practiceValue,
    practiceTask, extractedMetadata
  }
  ```

**前端展示**：
- ✅ `/comparison/[batchId]/entry/[entryId]/page.tsx`：单条目对比详情页
  - **只展示了评分对比**（总分 + 5个维度的进度条）
  - **没有展示 decision 的内容**
- ✅ `ComparisonList.tsx`：批次结果列表
  - 只展示了分差和胜负

### 1.2 核心问题

**数据已经完整存储，但前端只展示了冰山一角（评分），没有展示决策内容的差异。**

根据 E2E 分析文档：
- Tooling 模式有 14 个标签，Two-Step 只有 10 个 → **前端没展示**
- Tooling 模式有更多元数据字段 → **前端没展示**
- Two-Step 的演进链路结构更清晰 → **前端没展示**
- Tooling 的叙事结构更丰富 → **前端没展示**

---

## 二、目标定义

### 2.1 用户目标

**让用户能直观对比两种模式在内容质量上的差异，而不仅仅是评分差异。**

具体来说：
1. 看到两种模式提取的标签有什么不同
2. 看到两种模式的摘要表达有什么差异
3. 看到两种模式的要点数量和内容差异
4. 看到两种模式的结构化内容差异（这是核心）
5. 看到两种模式的元数据差异（Tooling 独有）

### 2.2 技术目标

1. **充分利用已有数据**：不需要修改后端，只需前端展示
2. **差异化渲染**：Two-Step 和 Tooling 的结构不同，需要不同的渲染方式
3. **保持简洁**：不要过度设计，聚焦核心对比维度
4. **✨ 空值安全**：所有组件都能优雅处理缺失数据（软失败）
5. **✨ 向后兼容**：支持 `keyPoints` 和 `keyPointsNew` 双格式

### 2.3 成功标准

- ✅ 用户能看到 6 个核心维度的并排对比
- ✅ Two-Step 的演进链路（initialApproach → finalChoice）可视化
- ✅ Tooling 的叙事结构（focus + details）和元数据得到展示
- ✅ 评分对比保持现有展示（已经做得不错）
- ✅ **缺失数据时显示友好的空状态，不崩溃**

---

## 三、对比维度设计

### 3.1 固定的 6 个对比维度

基于 `NormalizedAgentIngestDecision` 的结构，定义 6 个核心对比维度：

#### 维度 1: 基础分类
- **字段**: `contentType`, `techDomain`, `aiTags`, `confidence`
- **对比点**: 标签数量、置信度差异
- **展示方式**: 并排展示，标签用 Badge
- **✨ 空状态**: "暂无分类信息"

#### 维度 2: 核心摘要
- **字段**: `coreSummary`
- **对比点**: 字符数、表达风格
- **展示方式**: 并排展示文本，标注字符数
- **✨ 空状态**: "暂无摘要"

#### 维度 3: 关键要点
- **字段**: `keyPointsNew.core`, `keyPointsNew.extended`（回退到 `keyPoints`）
- **对比点**: 数量、内容差异
- **展示方式**: 分 core 和 extended 两组，并排展示
- **✨ 空状态**: "暂无要点"

#### 维度 4: 结构化内容（核心，差异最大）
- **字段**: `summaryStructure.type`, `summaryStructure.fields`
- **对比点**: 结构类型、字段数量、内容组织方式
- **展示方式**:
  - Two-Step: 展示演进链路（如果是 timeline-evolution）
  - Tooling: 展示叙事结构和额外字段
  - 动态渲染，根据实际结构选择渲染器
  - **✨ 未知类型使用 GenericStructureRenderer**
- **✨ 空状态**: "暂无结构化内容"

#### 维度 5: 边界定义
- **字段**: `boundaries.applicable`, `boundaries.notApplicable`
- **对比点**: 数量、内容差异
- **展示方式**: 并排展示列表
- **✨ 空状态**: "暂无边界定义"

#### 维度 6: 元数据
- **字段**: `difficulty`, `sourceTrust`, `timeliness`, `contentForm`
- **对比点**: Tooling 可能有更多元数据
- **展示方式**: 表格或 Badge 展示
- **✨ 空状态**: "暂无元数据"
- **说明**: 此维度展示顶层元数据，与维度 4 中 Tooling 的叙事结构内元数据不冲突

### 3.2 保留的评分维度

- **字段**: `originalScore`, `comparisonScore`
- **展示方式**: 保持现有的进度条展示（已经做得不错）

---

## 四、技术方案

### 4.1 架构设计

```
现有数据（ModeComparison 表）
  ↓
前端读取 originalDecision & comparisonDecision
  ↓
normalizeDecision() 规范化（空值安全 + keyPoints 回退）
  ↓
6 个 DimensionCard 组件
  ↓
动态选择渲染器（根据 summaryStructure.type）
  ↓
空状态处理（软失败）
```

**关键点**：
- ✅ 不需要修改后端
- ✅ 不需要修改数据库
- ✅ 只需要前端组件和工具函数
- ✅ **所有数据访问都经过规范化层**

### 4.2 数据规范化层

**✨ 新增核心工具函数**：

```typescript
// src/lib/comparison/normalize.ts

import type { NormalizedAgentIngestDecision } from '@/lib/ai/agent/ingest-contract';

export interface NormalizedDecision {
  contentType: string;
  techDomain: string;
  aiTags: string[];
  confidence: number | null;
  coreSummary: string;
  keyPoints: {
    core: string[];
    extended: string[];
  };
  summaryStructure: {
    type: string;
    fields: Record<string, unknown>;
  };
  boundaries: {
    applicable: string[];
    notApplicable: string[];
  };
  metadata: {
    difficulty: string | null;
    sourceTrust: string | null;
    timeliness: string | null;
    contentForm: string | null;
  };
}

/**
 * 规范化 decision 数据，提供空值安全和向后兼容
 *
 * 关键特性：
 * 1. keyPoints 回退：优先使用 keyPointsNew，回退到 keyPoints
 * 2. 空值安全：所有字段都有默认值
 * 3. 类型安全：明确的返回类型
 */
export function normalizeDecision(
  decision: Partial<NormalizedAgentIngestDecision> | null | undefined
): NormalizedDecision {
  if (!decision) {
    return getEmptyDecision();
  }

  // keyPoints 回退逻辑
  const keyPoints = decision.keyPointsNew
    ? {
        core: decision.keyPointsNew.core || [],
        extended: decision.keyPointsNew.extended || [],
      }
    : {
        core: decision.keyPoints || [],
        extended: [],
      };

  return {
    contentType: decision.contentType || '未知',
    techDomain: decision.techDomain || '未知',
    aiTags: decision.aiTags || [],
    confidence: decision.confidence ?? null,
    coreSummary: decision.coreSummary || '',
    keyPoints,
    summaryStructure: {
      type: decision.summaryStructure?.type || 'generic',
      fields: decision.summaryStructure?.fields || {},
    },
    boundaries: {
      applicable: decision.boundaries?.applicable || [],
      notApplicable: decision.boundaries?.notApplicable || [],
    },
    metadata: {
      difficulty: decision.difficulty || null,
      sourceTrust: decision.sourceTrust || null,
      timeliness: decision.timeliness || null,
      contentForm: decision.contentForm || null,
    },
  };
}

function getEmptyDecision(): NormalizedDecision {
  return {
    contentType: '未知',
    techDomain: '未知',
    aiTags: [],
    confidence: null,
    coreSummary: '',
    keyPoints: { core: [], extended: [] },
    summaryStructure: { type: 'generic', fields: {} },
    boundaries: { applicable: [], notApplicable: [] },
    metadata: {
      difficulty: null,
      sourceTrust: null,
      timeliness: null,
      contentForm: null,
    },
  };
}
```

### 4.3 前端组件设计

#### 4.3.1 页面结构

```
ComparisonDetailPage（改造现有页面）
├── ComparisonHeader（保留现有）
├── OverallScoreCard（保留现有）
├── DimensionScoreCard（保留现有的 5 维度评分）
├── NEW: ClassificationCard（维度 1）
├── NEW: SummaryCard（维度 2）
├── NEW: KeyPointsCard（维度 3）
├── NEW: StructureCard（维度 4，核心）
├── NEW: BoundariesCard（维度 5）
└── NEW: MetadataCard（维度 6）
```

#### 4.3.2 空状态组件

```typescript
// src/components/comparison/EmptyState.tsx

interface EmptyStateProps {
  message: string;
}

export function EmptyState({ message }: EmptyStateProps) {
  return (
    <div className="flex items-center justify-center py-8 text-muted-foreground">
      <p className="text-sm">{message}</p>
    </div>
  );
}
```

#### 4.3.3 GenericStructureRenderer

**✨ 新增兜底渲染器**：

```typescript
// src/components/comparison/renderers/GenericStructureRenderer.tsx

interface GenericStructureRendererProps {
  fields: Record<string, unknown>;
}

/**
 * 通用结构渲染器 - 用于未知或不支持的 summaryStructure.type
 *
 * 特性：
 * 1. 安全渲染对象和数组
 * 2. 深度限制（防止无限递归）
 * 3. 键值对展示
 */
export function GenericStructureRenderer({ fields }: GenericStructureRendererProps) {
  if (!fields || Object.keys(fields).length === 0) {
    return <EmptyState message="暂无结构化内容" />;
  }

  return (
    <div className="space-y-3">
      {Object.entries(fields).map(([key, value]) => (
        <div key={key} className="border-l-2 border-muted pl-3">
          <h5 className="font-medium text-sm capitalize">{key}</h5>
          <div className="mt-1 text-sm text-muted-foreground">
            {renderValue(value, 0)}
          </div>
        </div>
      ))}
    </div>
  );
}

function renderValue(value: unknown, depth: number): React.ReactNode {
  // 深度限制
  if (depth > 3) {
    return <span className="text-xs text-muted">[嵌套过深]</span>;
  }

  if (value === null || value === undefined) {
    return <span className="text-muted">-</span>;
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return <span>{String(value)}</span>;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <span className="text-muted">[]</span>;
    }
    return (
      <ul className="list-disc list-inside space-y-1">
        {value.slice(0, 10).map((item, i) => (
          <li key={i}>{renderValue(item, depth + 1)}</li>
        ))}
        {value.length > 10 && (
          <li className="text-xs text-muted">...还有 {value.length - 10} 项</li>
        )}
      </ul>
    );
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) {
      return <span className="text-muted">{'{}'}</span>;
    }
    return (
      <div className="space-y-1 pl-3">
        {entries.slice(0, 5).map(([k, v]) => (
          <div key={k}>
            <span className="font-medium">{k}:</span> {renderValue(v, depth + 1)}
          </div>
        ))}
        {entries.length > 5 && (
          <div className="text-xs text-muted">...还有 {entries.length - 5} 个字段</div>
        )}
      </div>
    );
  }

  return <span className="text-muted">[无法渲染]</span>;
}
```

---

## 五、实施计划

### Phase 0: 数据审计（0.5h）✨ 新增

**目标**: 确认实际数据结构和字段存在性

**任务**:
1. 采样最近 5-10 条 `ModeComparison` 数据（两种模式各 5 条）
2. 记录实际的 `summaryStructure.type` 分布
3. 确认 `keyPoints` vs `keyPointsNew` 的存在情况
4. 确认 `originalMode` 和 `comparisonMode` 字段值

**验收标准**:
- ✅ 了解实际数据分布
- ✅ 确认需要支持的结构类型
- ✅ 确认回退逻辑的必要性

**产物**: 数据审计报告（可以是简单的文本记录）

---

### Phase 1: 数据规范化和基础组件（3-4h）

**目标**: 创建规范化层和 5 个基础对比卡片

**任务**:
1. 创建 `src/lib/comparison/normalize.ts`
   - 实现 `normalizeDecision()` 函数
   - 实现 `getEmptyDecision()` 函数
   - 添加单元测试
2. 创建 `src/components/comparison/EmptyState.tsx`
3. 创建 `src/components/comparison/dimensions/` 目录
4. 创建基础组件（带空状态处理）：
   - `ClassificationCard.tsx`（维度 1）
   - `SummaryCard.tsx`（维度 2）
   - `KeyPointsCard.tsx`（维度 3）
   - `BoundariesCard.tsx`（维度 5）
   - `MetadataCard.tsx`（维度 6）
5. 修改 `src/app/comparison/[batchId]/entry/[entryId]/page.tsx`
   - 读取 `originalDecision` 和 `comparisonDecision`
   - 使用 `normalizeDecision()` 规范化
   - 集成新的对比卡片

**验收标准**:
- ✅ 5 个基础维度能并排展示
- ✅ 数据正确读取和展示
- ✅ 缺失数据时显示空状态，不崩溃

---

### Phase 2: 结构化内容动态渲染（4-5h）

**目标**: 实现维度 4（结构化内容）的差异化渲染

**任务**:
1. 创建 `StructureCard.tsx`（容器组件）
2. 创建 `StructureRenderer.tsx`（路由组件）
3. 创建 `TwoStepTimelineRenderer.tsx`（Two-Step 专用，带空值检查）
4. 创建 `ToolingTimelineRenderer.tsx`（Tooling 专用，带空值检查）
5. 创建 `GenericStructureRenderer.tsx`（通用渲染器）✨ 新增
6. 创建 `Section.tsx`（辅助组件）

**验收标准**:
- ✅ Two-Step 的演进链路清晰可见
- ✅ Tooling 的叙事结构和元数据得到展示
- ✅ 未知结构类型能正常展示（GenericStructureRenderer）
- ✅ 缺失字段时优雅降级

---

### Phase 3: 样式优化和测试（2-3h）

**目标**: 优化视觉效果，确保功能稳定

**任务**:
1. 统一配色和间距
2. 增加响应式布局
3. 增加加载状态
4. 测试不同内容类型的展示
5. 测试边界情况：
   - 完全缺失的 decision
   - 只有 keyPoints 没有 keyPointsNew
   - 未知的 summaryStructure.type
   - 空数组和空对象
6. 添加错误边界组件（可选）

**验收标准**:
- ✅ 视觉效果统一美观
- ✅ 移动端展示正常
- ✅ 所有边界情况处理正确
- ✅ 无控制台错误

---

### Phase 4: 文档和收尾（1h）

**目标**: 更新文档，完成交付

**任务**:
1. 更新用户指南
2. 截图展示新功能
3. 更新 PROGRESS.md
4. 记录已知限制（如果有）

**验收标准**:
- ✅ 文档完整
- ✅ 功能可用

---

## 六、时间估算

- Phase 0: 0.5h（数据审计）✨ 新增
- Phase 1: 3-4h（规范化层 + 基础组件）
- Phase 2: 4-5h（结构化内容动态渲染）
- Phase 3: 2-3h（样式优化和测试）
- Phase 4: 1h（文档和收尾）

**总计**: **12-14h**（约 1.5-2 个工作日）

**变更**: v2.0 的 10-13h → v2.1 的 12-14h（+2-3h 用于规范化层和边界测试）

---

## 七、风险和挑战

### 7.1 技术风险

**风险 1: summaryStructure.fields 的结构差异过大**
- **影响**: 难以统一渲染
- **缓解**: 先支持 timeline-evolution，其他类型用 GenericStructureRenderer ✨
- **应对**: 如果差异过大，增加更多专用渲染器

**风险 2: 数据缺失或格式不符**
- **影响**: 渲染出错或崩溃
- **缓解**: normalizeDecision() 提供空值安全 ✨
- **应对**: 增加错误边界组件

### 7.2 产品风险

**风险 1: 信息过载**
- **影响**: 用户看不过来，体验差
- **缓解**: 保持简洁，聚焦核心对比
- **应对**: 收集用户反馈，后续迭代增加折叠/展开功能

---

## 八、后续优化方向

### 8.1 短期优化（1周内）

1. **增加折叠/展开功能**：对于长内容，默认折叠（v2.2）
2. **增加高亮差异**：自动标注两种模式的差异点
3. **增加复制功能**：复制对比结果

### 8.2 中期优化（1个月内）

1. **增加可视化**：雷达图、时间线图
2. **增加导出功能**：导出为 Markdown 或 PDF
3. **增加批量对比**：对比多个 Entry

### 8.3 长期优化（3个月+）

1. **智能推荐**：根据内容类型推荐模式
2. **A/B 测试**：收集用户偏好数据
3. **混合模式**：结合两种模式的优势

---

## 九、总结

### 9.1 核心价值

1. **充分利用已有数据**：不需要修改后端，只需前端展示
2. **清晰对比内容差异**：6 个维度并排展示，一目了然
3. **差异化渲染**：Two-Step 和 Tooling 各展所长
4. **✨ 生产级质量**：空值安全、向后兼容、优雅降级

### 9.2 关键改进

相比 v2.0 方案：
- ✅ 新增数据规范化层（空值安全 + keyPoints 回退）
- ✅ 新增 GenericStructureRenderer（兜底渲染器）
- ✅ 所有组件增加空状态处理
- ✅ 工具函数类型安全改进
- ✅ 时间估算更准确（12-14h）

### 9.3 Codex 评审共识

**已达成共识**：
1. ✅ 元数据"重复"不是问题（两个不同展示维度）
2. ✅ "字"的标注在中文语境下合理
3. ✅ 折叠/展开功能可以后续迭代
4. ✅ 软失败策略（空状态，不崩溃）
5. ✅ 生产环境不记录缺失字段日志
6. ✅ keyPointsNew 优先，keyPoints 回退
7. ✅ 数据审计采用快速采样（5-10 条）
8. ✅ 卡片标题已足够区分，暂不需要额外提示

---

## 十、待确认事项

1. ✅ Codex Layer 1 评审通过
2. ⏳ 用户确认方案可行性
3. ⏳ 用户确认时间估算合理
4. ⏳ 用户确认可以进入实施阶段

---

**下一步**: 等待用户确认后，进入 Phase 0（数据审计）。
