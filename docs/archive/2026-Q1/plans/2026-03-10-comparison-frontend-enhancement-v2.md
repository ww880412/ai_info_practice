# Mode Comparison 前端增强方案 v2.1

> **文档类型**: 设计方案（基于现状迭代）
> **创建时间**: 2026-03-10
> **最后更新**: 2026-03-10
> **状态**: 已确认（进入实施）
> **相关文档**:
> - [mode-comparison-e2e-analysis.md](../analysis/mode-comparison-e2e-analysis.md)
> - [mode-comparison-scoring-issues.md](../analysis/mode-comparison-scoring-issues.md)

---

## 一、现状分析

### 1.1 已有功能

**数据层**：
- ✅ `ModeComparison` 表已存储完整对比数据
  - `originalDecision`: `NormalizedAgentIngestDecision`（JSON）
  - `comparisonDecision`: `NormalizedAgentIngestDecision`（JSON）
  - `originalScore`: `QualityEvaluation`（JSON）
  - `comparisonScore`: `QualityEvaluation`（JSON）
  - `winner` / `scoreDiff`

- ✅ `NormalizedAgentIngestDecision` 包含完整信息：
  ```typescript
  {
    contentType, techDomain, aiTags,           // 基础分类
    coreSummary, keyPoints, keyPointsNew,      // 核心内容
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

### 2.3 成功标准

- ✅ 用户能看到 6 个核心维度的并排对比
- ✅ Two-Step 的演进链路（initialApproach → finalChoice）可视化
- ✅ Tooling 的叙事结构（focus + details）和元数据得到展示
- ✅ 评分对比保持现有展示（已经做得不错）
- ✅ 缺失字段不影响页面渲染，卡片展示空态文案

---

## 三、对比维度设计

### 3.1 固定的 6 个对比维度

基于 `NormalizedAgentIngestDecision` 的结构，定义 6 个核心对比维度：

#### 维度 1: 基础分类
- **字段**: `contentType`, `techDomain`, `aiTags`, `confidence`
- **对比点**: 标签数量、置信度差异
- **展示方式**: 并排展示，标签用 Badge

#### 维度 2: 核心摘要
- **字段**: `coreSummary`
- **对比点**: 字数、表达风格
- **展示方式**: 并排展示文本，标注字数

#### 维度 3: 关键要点
- **字段**: `keyPointsNew.core`, `keyPointsNew.extended`
- **对比点**: 数量、内容差异
- **展示方式**: 分 core 和 extended 两组，并排展示

#### 维度 4: 结构化内容（核心，差异最大）
- **字段**: `summaryStructure.type`, `summaryStructure.fields`
- **对比点**: 结构类型、字段数量、内容组织方式
- **展示方式**:
  - Two-Step: 展示演进链路（如果是 timeline-evolution）
  - Tooling: 展示叙事结构和额外字段
  - 动态渲染，根据实际结构选择渲染器

#### 维度 5: 边界定义
- **字段**: `boundaries.applicable`, `boundaries.notApplicable`
- **对比点**: 数量、内容差异
- **展示方式**: 并排展示列表

#### 维度 6: 元数据
- **字段**: `difficulty`, `sourceTrust`, `timeliness`, `contentForm`
- **对比点**: Tooling 可能有更多元数据
- **展示方式**: 表格或 Badge 展示

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
提取对比维度（客户端工具函数）
  ↓
6 个 DimensionCard 组件
  ↓
动态选择渲染器（根据 summaryStructure.type）
```

**关键点**：
- ✅ 不需要修改后端
- ✅ 不需要修改数据库
- ✅ 只需要前端组件和工具函数

### 4.2 前端组件设计

#### 4.2.1 页面结构

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

#### 4.2.2 关键组件

**ClassificationCard（维度 1）**
```tsx
<Card>
  <CardHeader>基础分类</CardHeader>
  <CardContent>
    <div className="grid grid-cols-2 gap-4">
      {/* 左侧：原始模式 */}
      <div>
        <Badge>{original.contentType}</Badge>
        <Badge>{original.techDomain}</Badge>
        <div className="flex flex-wrap gap-1">
          {original.aiTags.map(tag => <Badge variant="outline">{tag}</Badge>)}
        </div>
        <p className="text-sm">置信度: {original.confidence}</p>
      </div>

      {/* 右侧：对比模式 */}
      <div>
        {/* 同上 */}
      </div>
    </div>
  </CardContent>
</Card>
```

**SummaryCard（维度 2）**
```tsx
<Card>
  <CardHeader>核心摘要</CardHeader>
  <CardContent>
    <div className="grid grid-cols-2 gap-4">
      <div>
        <p className="text-sm text-secondary">
          {original.coreSummary.length} 字
        </p>
        <p className="mt-2">{original.coreSummary}</p>
      </div>
      <div>
        <p className="text-sm text-secondary">
          {comparison.coreSummary.length} 字
        </p>
        <p className="mt-2">{comparison.coreSummary}</p>
      </div>
    </div>
  </CardContent>
</Card>
```

**KeyPointsCard（维度 3）**
```tsx
<Card>
  <CardHeader>关键要点</CardHeader>
  <CardContent>
    <div className="grid grid-cols-2 gap-4">
      <div>
        <h4 className="font-medium">核心要点 ({original.keyPointsNew.core.length})</h4>
        {original.keyPointsNew.core.length > 0 ? (
          <ul>
            {original.keyPointsNew.core.map((point, i) => (
              <li key={i}>{point}</li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">暂无数据</p>
        )}

        <h4 className="font-medium mt-4">扩展要点 ({original.keyPointsNew.extended.length})</h4>
        {original.keyPointsNew.extended.length > 0 ? (
          <ul>
            {original.keyPointsNew.extended.map((point, i) => (
              <li key={i}>{point}</li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">暂无数据</p>
        )}
      </div>
      <div>
        {/* 同上 */}
      </div>
    </div>
  </CardContent>
</Card>
```

**StructureCard（维度 4，核心）**
```tsx
<Card>
  <CardHeader>结构化内容</CardHeader>
  <CardContent>
    <div className="grid grid-cols-2 gap-4">
      {/* 左侧：原始模式 */}
      <div>
        {original.summaryStructure ? (
          <>
            <p className="text-sm text-secondary">
              类型: {original.summaryStructure.type}
            </p>
            <StructureRenderer
              structure={original.summaryStructure}
              mode={originalMode}
            />
          </>
        ) : (
          <p className="text-sm text-muted-foreground">该模式未生成此维度内容</p>
        )}
      </div>

      {/* 右侧：对比模式 */}
      <div>
        {comparison.summaryStructure ? (
          <>
            <p className="text-sm text-secondary">
              类型: {comparison.summaryStructure.type}
            </p>
            <StructureRenderer
              structure={comparison.summaryStructure}
              mode={comparisonMode}
            />
          </>
        ) : (
          <p className="text-sm text-muted-foreground">该模式未生成此维度内容</p>
        )}
      </div>
    </div>
  </CardContent>
</Card>

// StructureRenderer 根据 type 和 mode 动态选择渲染方式
function StructureRenderer({ structure, mode }) {
  if (structure.type === 'timeline-evolution') {
    if (mode === 'two-step') {
      return <TwoStepTimelineRenderer fields={structure.fields} />;
    } else {
      return <ToolingTimelineRenderer fields={structure.fields} />;
    }
  }

  // 其他结构类型的渲染器
  return <GenericStructureRenderer fields={structure.fields} />;
}
```

**TwoStepTimelineRenderer（Two-Step 专用）**
```tsx
function TwoStepTimelineRenderer({ fields }) {
  const events = fields.events || [];

  return (
    <div className="space-y-4">
      {fields.background && (
        <Section title="背景">{fields.background}</Section>
      )}

      <Section title="演进阶段">
        {events.map((event, i) => (
          <div key={i} className="border-l-2 border-primary pl-4 pb-4">
            <h5 className="font-medium">{event.stage}</h5>

            {/* 演进链路 */}
            <div className="mt-2 space-y-2 text-sm">
              {event.initialApproach && (
                <div>
                  <span className="text-secondary">初始方案:</span>
                  <p>{event.initialApproach}</p>
                </div>
              )}
              {event.problem && (
                <div>
                  <span className="text-secondary">遇到问题:</span>
                  <p>{event.problem}</p>
                </div>
              )}
              {event.iteration && (
                <div>
                  <span className="text-secondary">迭代尝试:</span>
                  <p>{event.iteration}</p>
                </div>
              )}
              {event.result && (
                <div>
                  <span className="text-secondary">结果:</span>
                  <p>{event.result}</p>
                </div>
              )}
              {event.finalChoice && (
                <div>
                  <span className="text-secondary">最终方案:</span>
                  <p className="font-medium">{event.finalChoice}</p>
                </div>
              )}
            </div>
          </div>
        ))}
      </Section>

      {fields.currentStatus && (
        <Section title="当前状态">{fields.currentStatus}</Section>
      )}
      {fields.futureOutlook && (
        <Section title="未来展望">{fields.futureOutlook}</Section>
      )}
      {fields.finalInsight && (
        <Section title="最终洞察">{fields.finalInsight}</Section>
      )}
    </div>
  );
}
```

**ToolingTimelineRenderer（Tooling 专用）**
```tsx
function ToolingTimelineRenderer({ fields }) {
  const events = fields.events || [];

  return (
    <div className="space-y-4">
      {fields.background && (
        <Section title="背景">{fields.background}</Section>
      )}

      <Section title="演进阶段">
        {events.map((event, i) => (
          <div key={i} className="border-l-2 border-primary pl-4 pb-4">
            <h5 className="font-medium">{event.stage}</h5>

            {/* 叙事结构 */}
            {event.focus && (
              <p className="mt-2 text-sm text-secondary">{event.focus}</p>
            )}
            {event.details && (
              <ul className="mt-2 space-y-1 text-sm">
                {event.details.map((detail, j) => (
                  <li key={j}>• {detail}</li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </Section>

      {/* Tooling 独有的丰富字段 */}
      {fields.sourceCredibility && (
        <Section title="来源可信度">
          <Badge>{fields.sourceCredibility}</Badge>
        </Section>
      )}
      {fields.timeliness && (
        <Section title="时效性">
          <Badge>{fields.timeliness}</Badge>
        </Section>
      )}
      {fields.completeness && (
        <Section title="完整性">
          <Badge>{fields.completeness}</Badge>
        </Section>
      )}
      {fields.difficultyLevel && (
        <Section title="难度等级">
          <Badge>{fields.difficultyLevel}</Badge>
        </Section>
      )}

      {fields.currentStatus && (
        <Section title="当前状态">
          {typeof fields.currentStatus === 'object' ? (
            <>
              <p><strong>状态:</strong> {fields.currentStatus.state}</p>
              <p><strong>证据:</strong> {fields.currentStatus.evidence}</p>
            </>
          ) : (
            <p>{fields.currentStatus}</p>
          )}
        </Section>
      )}

      {fields.futureOutlook && (
        <Section title="未来展望">
          {typeof fields.futureOutlook === 'object' ? (
            <>
              <p><strong>方向:</strong> {fields.futureOutlook.direction}</p>
              {fields.futureOutlook.openQuestions && (
                <>
                  <p className="mt-2"><strong>开放问题:</strong></p>
                  <ul>
                    {fields.futureOutlook.openQuestions.map((q, i) => (
                      <li key={i}>• {q}</li>
                    ))}
                  </ul>
                </>
              )}
            </>
          ) : (
            <p>{fields.futureOutlook}</p>
          )}
        </Section>
      )}

      {fields.finalInsight && (
        <Section title="最终洞察">{fields.finalInsight}</Section>
      )}
    </div>
  );
}
```

**BoundariesCard（维度 5）**
```tsx
<Card>
  <CardHeader>适用边界</CardHeader>
  <CardContent>
    <div className="grid grid-cols-2 gap-4">
      <div>
        <h4 className="font-medium">适用场景</h4>
        <ul>
          {original.boundaries.applicable.map((item, i) => (
            <li key={i}>✓ {item}</li>
          ))}
        </ul>

        <h4 className="font-medium mt-4">不适用场景</h4>
        <ul>
          {original.boundaries.notApplicable.map((item, i) => (
            <li key={i}>✗ {item}</li>
          ))}
        </ul>
      </div>
      <div>
        {/* 同上 */}
      </div>
    </div>
  </CardContent>
</Card>
```

**MetadataCard（维度 6）**
```tsx
<Card>
  <CardHeader>元数据</CardHeader>
  <CardContent>
    <div className="grid grid-cols-2 gap-4">
      <div>
        <div className="space-y-2">
          <div>
            <span className="text-sm text-secondary">难度:</span>
            <Badge>{original.difficulty}</Badge>
          </div>
          <div>
            <span className="text-sm text-secondary">来源可信度:</span>
            <Badge>{original.sourceTrust}</Badge>
          </div>
          <div>
            <span className="text-sm text-secondary">时效性:</span>
            <Badge>{original.timeliness}</Badge>
          </div>
          <div>
            <span className="text-sm text-secondary">内容形式:</span>
            <Badge>{original.contentForm}</Badge>
          </div>
        </div>
      </div>
      <div>
        {/* 同上 */}
      </div>
    </div>
  </CardContent>
</Card>
```

### 4.3 工具函数

新增统一归一化工具，确保字段缺失时页面稳定：

```typescript
// src/lib/comparison/utils.ts
import type { NormalizedAgentIngestDecision } from '@/lib/ai/agent/ingest-contract';

const EMPTY_KEY_POINTS = { core: [] as string[], extended: [] as string[] };

export function normalizeDecision(decision?: NormalizedAgentIngestDecision | null) {
  if (!decision) {
    return {
      contentType: 'unknown',
      techDomain: 'unknown',
      aiTags: [],
      coreSummary: '',
      keyPoints: [],
      keyPointsNew: EMPTY_KEY_POINTS,
      summaryStructure: null,
      boundaries: { applicable: [], notApplicable: [] },
      confidence: null,
      difficulty: null,
      sourceTrust: null,
      timeliness: null,
      contentForm: null,
      practiceTask: null,
      extractedMetadata: null,
    };
  }

  const keyPoints = decision.keyPointsNew || {
    core: decision.keyPoints || [],
    extended: [],
  };

  return {
    ...decision,
    aiTags: decision.aiTags || [],
    keyPointsNew: keyPoints,
  };
}
```

所有维度组件都基于 `normalizeDecision()` 的返回值渲染。

### 4.4 运行时容错与空态策略

- **软失败**：缺失字段不影响渲染，卡片保留但展示空态文案。
- **空态文案**：优先使用“暂无数据”；结构缺失使用“该模式未生成此维度内容”。
- **未知结构**：`summaryStructure.type` 无法识别时，使用 `GenericStructureRenderer` 兜底。
- **日志策略**：生产环境保持静默；开发环境可按需 `console.warn`（`process.env.NODE_ENV !== 'production'`）。

---

## 五、实施计划

### Phase 1: 基础组件（3-4h）

**目标**: 创建 6 个维度的基础对比卡片

**任务**:
0. Quick data audit（0.5h）：抽样检查每种模式最近 5-10 条记录的 decision 结构
1. 创建 `src/components/comparison/dimensions/` 目录
2. 创建基础组件：
   - `ClassificationCard.tsx`（维度 1）
   - `SummaryCard.tsx`（维度 2）
   - `KeyPointsCard.tsx`（维度 3）
   - `BoundariesCard.tsx`（维度 5）
   - `MetadataCard.tsx`（维度 6）
3. 创建工具函数 `src/lib/comparison/utils.ts`（含 `normalizeDecision()`）
4. 修改 `src/app/comparison/[batchId]/entry/[entryId]/page.tsx`
   - 读取 `originalDecision` 和 `comparisonDecision`
   - 集成新的对比卡片

**验收标准**:
- ✅ 5 个基础维度能并排展示
- ✅ 数据正确读取和展示
- ✅ 缺失字段不影响渲染

---

### Phase 2: 结构化内容动态渲染（4-5h）

**目标**: 实现维度 4（结构化内容）的差异化渲染

**任务**:
1. 创建 `StructureCard.tsx`（容器组件）
2. 创建 `StructureRenderer.tsx`（路由组件）
3. 创建 `TwoStepTimelineRenderer.tsx`（Two-Step 专用）
4. 创建 `ToolingTimelineRenderer.tsx`（Tooling 专用）
5. 创建 `GenericStructureRenderer.tsx`（通用渲染器）
6. 创建 `Section.tsx`（辅助组件）
7. 为未知结构类型提供降级渲染（Generic + 空态）

**验收标准**:
- ✅ Two-Step 的演进链路清晰可见
- ✅ Tooling 的叙事结构和元数据得到展示
- ✅ 其他结构类型也能正常展示
- ✅ 未知类型使用 GenericStructureRenderer 回退

---

### Phase 3: 样式优化和测试（2-3h）

**目标**: 优化视觉效果，确保功能稳定

**任务**:
1. 统一配色和间距
2. 增加响应式布局
3. 增加加载状态和错误处理
4. 测试不同内容类型的展示
5. 测试边界情况（缺少某些字段）

**验收标准**:
- ✅ 视觉效果统一美观
- ✅ 移动端展示正常
- ✅ 边界情况处理正确

---

### Phase 4: 文档和收尾（1h）

**目标**: 更新文档，完成交付

**任务**:
1. 更新用户指南
2. 截图展示新功能
3. 更新 PROGRESS.md

**验收标准**:
- ✅ 文档完整
- ✅ 功能可用

---

## 六、时间估算

- Phase 0: 0.5h（数据审计）
- Phase 1: 3-4h（基础组件）
- Phase 2: 4-5h（结构化内容动态渲染）
- Phase 3: 2-3h（样式优化和测试）
- Phase 4: 1h（文档和收尾）

**总计**: 12-14h（约 1.5-2 个工作日）

---

## 七、风险和挑战

### 7.1 技术风险

**风险 1: summaryStructure.fields 的结构差异过大**
- **影响**: 难以统一渲染
- **缓解**: 先支持 timeline-evolution，其他类型用通用渲染器
- **应对**: 如果差异过大，增加更多专用渲染器

**风险 2: 数据缺失或格式不符**
- **影响**: 渲染出错或崩溃
- **缓解**: 增加空值检查和默认值
- **应对**: 增加错误边界组件

### 7.2 产品风险

**风险 1: 信息过载**
- **影响**: 用户看不过来，体验差
- **缓解**: 使用折叠/展开功能
- **应对**: 收集用户反馈，调整展示优先级

---

## 八、后续优化方向

### 8.1 短期优化（1周内）

1. **增加折叠/展开功能**：对于长内容，默认折叠
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
4. **实施成本低**：12-14h 即可完成

### 9.2 关键改进

相比 v1 方案：
- ✅ 不需要修改后端（省去 Phase 1 的后端改动）
- ✅ 不需要定义新的契约（直接使用现有数据结构）
- ✅ 实施时间缩短（从 13-18h 缩短到 12-14h）
- ✅ 方案更简洁（聚焦前端展示）
 - ✅ 补充空态与未知结构的运行时容错

---

## 十、待确认事项

1. ✅ 6 个对比维度是否完整？是否需要增加或删除？
2. ✅ 结构化内容的渲染方式是否合理？
3. ✅ 实施计划的优先级是否正确？
4. ✅ 时间估算是否合理？
5. ✅ 是否有其他需要考虑的风险？

---

**下一步**: 进入实施阶段（Phase 0 数据审计）。
