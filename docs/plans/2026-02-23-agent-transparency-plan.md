# 方向二：Agent 信息透明化 - 实施计划

> **版本**: v1.4
> **日期**: 2026-02-23
> **状态**: Draft

---

## 1. 目标

解决"对提取的信息不太有底"的问题：
- A) 不知道 Agent 提取了哪些信息、提取的质量如何 ✅
- B) 想知道推理过程（Reasoning Trace）的详细信息 ✅
- C) 想对提取的内容进行质量评估或管理 ✅
- 核心：信息透明化，让用户能"看到"AI 的思考过程和产出质量

---

## 2. 方案概述

### 2.1 核心思路

| 用户需求 | 解决方案 |
|---------|---------|
| 提取了哪些信息 | 字段级展示 + 来源标注 |
| 提取质量如何 | 置信度评分 + 质量维度面板 |
| 推理过程详情 | Reasoning Trace 可视化 |

---

## 3. Phase 1：增强详情页元数据（轻量起步）

### 3.1 实施方案

**目标：** 在 Entry 详情页增加"提取信息总览"面板

**功能：**
1. **提取字段列表**：展示所有 AI 提取的字段
2. **字段级置信度**：每个字段标注置信度（高/中/低）
3. **数据来源标注**：标注字段是来自 AI 提取还是用户输入

**UI 布局（Entry 详情页）：**
```
┌─────────────────────────────────────────────────┐
│ Entry: xxx                    [Reprocess] [Del] │
├─────────────────────────────────────────────────┤
│ [Overview] [Summary] [Trace] [Quality]          │  ← Tab 导航
├─────────────────────────────────────────────────┤
│ Overview Tab:                                    │
│ ┌─────────────────────────────────────────────┐ │
│ │ 提取字段          │ 置信度 │ 来源           │ │
│ │ ─────────────────────────────────────────── │ │
│ │ coreSummary       │ ⭐⭐⭐  │ AI            │ │
│ │ keyPoints         │ ⭐⭐⭐  │ AI            │ │
│ │ boundaries        │ ⭐⭐    │ AI            │ │
│ │ practiceTask      │ ⭐⭐⭐  │ AI            │ │
│ │ relatedEntries   │ ⭐      │ AI            │ │
│ └─────────────────────────────────────────────┘ │
│                                                  │
│ 来源分布: AI(5) | User(2) | System(1)          │
└─────────────────────────────────────────────────┘
```

**修改文件：**
- `src/components/entry/MetadataPanel.tsx` - 新建
- `src/app/entry/[id]/page.tsx` - 引入 MetadataPanel Tab

### 3.2 数据结构契约（最终版 v1.4）

#### 3.2.1 字段级置信度与来源映射

**存储位置**：`Entry.summaryStructure.meta`（与业务字段隔离）

**JSON Schema**：
```json
{
  "type": "problem-solution",
  "fields": {
    "problem": "...",
    "solution": "..."
  },
  "reasoning": "...",
  "meta": {
    "fieldConfidence": {
      "coreSummary": "high",
      "keyPoints": "high",
      "boundaries": "medium",
      "practiceTask": "high",
      "relatedEntries": "low"
    },
    "fieldSourceMap": {
      "coreSummary": "ai",
      "keyPoints": "ai",
      "boundaries": "ai",
      "practiceTask": "ai",
      "relatedEntries": "ai",
      "userNotes": "user",
      "customSummary": "user"
    },
    "extractedAt": "2026-02-23T10:00:00Z",
    "model": "gemini-2.0-flash-exp"
  }
}
```

**枚举值 - fieldConfidence：**
| 值 | 说明 |
|----|------|
| high | 高置信度 |
| medium | 中置信度 |
| low | 低置信度 |

**枚举值 - fieldSourceMap：**
| 值 | 说明 |
|----|------|
| ai | AI 提取 |
| user | 用户输入 |
| system | 系统生成 |

### 3.3 验收标准

| 验收项 | 标准 |
|-------|------|
| Tab 切换 | Overview/Summary/Trace/Quality 四个 Tab 正常切换 |
| 字段列表 | 展示所有 AI 提取的字段 |
| 置信度显示 | 每个字段显示高/中/低标识 |
| 来源标注 | 区分 AI 提取 / 用户输入 / 系统生成 |
| 降级展示 | 缺失 fieldConfidence 时显示"-" |
| 响应式 | 各屏幕宽度下布局正常 |

---

## 4. Phase 2：质量评估面板

### 4.1 实施方案

**目标：** 展示 5 个维度的质量评估，支持用户手动调整

**功能：**
1. **5 维度评分展示**：
   - 来源可信度（SOURCE_TRUST）
   - 时效性（TIMELINESS）
   - 完整度（COMPLETENESS）
   - 内容形式（CONTENT_FORM）
   - 难度级别（DIFFICULTY）
2. **综合置信度**：基于 5 维度的加权计算
3. **手动调整**：用户可覆盖 AI 评估结果
4. **调整历史**：记录用户手动调整的痕迹

**UI 布局（Quality Tab）：**
```
┌─────────────────────────────────────────────────┐
│ Quality Assessment                    [Save]    │
├─────────────────────────────────────────────────┤
│                                                  │
│ 综合置信度: ████████░░ 80%                       │
│                                                  │
│ ┌─────────────────────────────────────────────┐ │
│ │ 维度              │ AI 评估 │ 手动覆盖     │ │
│ │ ───────────────────────────────────────────│ │
│ │ 来源可信度        │ HIGH    │ -           │ │
│ │ 时效性            │ RECENT  │ -           │ │
│ │ 完整度            │ 85%     │ [override]  │ │
│ │ 内容形式          │ TEXTUAL │ -           │ │
│ │ 难度级别          │ MEDIUM  │ -           │ │
│ └─────────────────────────────────────────────┘ │
│                                                  │
│ 评估依据:                                        │
│ - 来源: 知名技术博客 (sourceTrust)               │
│ - 时效: 3 个月内更新                             │
│ - 完整度: 包含代码 示例 + 原理说明                │
│                                                  │
│ [Reset to AI] [View History]                    │
└─────────────────────────────────────────────────┘
```

**修改文件：**
- `src/components/entry/QualityPanel.tsx` - 新建
- `src/app/api/entries/[id]/quality` - PATCH API
- Prisma 新增 `QualityRevision` 模型

### 4.2 数据库模型（最终版 v1.3）

```prisma
model Entry {
  // 现有字段...

  // Phase 2 新增
  qualityOverride Json?  // 用户手动覆盖的评估

  // 一对多关系（移除 qualityHistoryId）
  qualityHistories QualityRevision[] @relation("EntryQualityHistory")
}

model QualityRevision {
  id              String   @id @default(cuid())
  entryId         String
  entry           Entry    @relation("EntryQualityHistory", fields: [entryId], references: [id], onDelete: Cascade)

  // 变更内容
  previousJson    Json     // 变更前的评估值
  newJson         Json     // 变更后的评估值
  overrideReason  String?  // 覆盖原因（用户填写）

  // 审计
  createdAt       DateTime @default(now())
  createdBy       String?  // 预留，未来支持多用户

  @@index([entryId])
}
```

### 4.3 API 契约

#### 4.3.1 获取质量评估

**GET /api/entries/[id]/quality**

Response：
```json
{
  "data": {
    "dimensions": {
      "sourceTrust": { "value": "HIGH", "label": "高" },
      "timeliness": { "value": "RECENT", "label": "近期" },
      "completeness": { "value": 0.85, "label": "85%" },
      "contentForm": { "value": "TEXTUAL", "label": "文本" },
      "difficulty": { "value": "MEDIUM", "label": "中等" }
    },
    "confidence": 0.8,
    "confidenceDisplay": "80%",
    "override": null,
    "history": [
      {
        "id": "xxx",
        "changedAt": "2026-02-23T10:00:00Z",
        "changes": ["completeness: 0.7 -> 0.85"]
      }
    ]
  }
}
```

#### 4.3.2 更新质量评估（手动覆盖）

**PATCH /api/entries/[id]/quality**

Request：
```json
{
  "override": {
    "completeness": 90,
    "difficulty": "EASY"
  },
  "reason": "内容较为基础，难度应该更低"
}
```

#### 4.3.3 手动覆盖影响范围

**决策**：手动覆盖**仅影响展示层**，不影响：
- 排序权重
- 推荐算法
- 后续 AI 处理

**理由**：保持数据纯净性，避免用户手动覆盖污染 AI 评估质量。

### 4.4 验收标准

| 验收项 | 标准 |
|-------|------|
| 5 维度显示 | 各维度评估值正确展示 |
| 综合置信度 | 正确计算并显示百分比 |
| 手动覆盖 | 用户可修改评估值 |
| 覆盖历史 | 记录并可查看调整历史 |
| 保存持久化 | 手动调整保存到数据库 |
| 回滚 | 支持一键回滚到 AI 评估结果 |

---

## 5. Phase 3：推理过程增强

### 5.1 实施方案

**目标：** 优化 Reasoning Trace 的展示，让用户更易懂

**功能：**
1. **步骤分组**：将推理步骤按阶段分组（领域识别 → 内容分析 → 类型判断 → ...）
2. **输入/输出展示**：每步骤展示输入和输出内容
3. **关键决策高亮**：对关键决策步骤（如策略选择）增加标注
4. **折叠/展开**：默认折叠详情，支持展开

### 5.2 Trace 阶段 Taxonomy

**阶段分组规则：**
| 阶段 | 标识 | 说明 |
|-----|------|------|
| analyze | 分析阶段 | 领域识别、内容分析、类型判断 |
| extract | 提取阶段 | 核心摘要提取、要点提取、边界提取 |
| generate | 生成阶段 | 实践任务生成、关联发现 |
| validate | 验证阶段 | 结果验证、质量检查 |

**关键决策标记规则：**
- 类型判断（contentType）
- 策略选择（processingStrategy）
- 置信度判定（confidence < 0.5 时）

### 5.3 API 契约

**GET /api/entries/[id]/trace**

Query 参数：
| 参数 | 类型 | 说明 |
|-----|------|------|
| mode | string | 返回模式：`normalized`（分组）/ `raw`（原始） |

**Response（normalized 模式）：**
```json
{
  "data": {
    "steps": [
      {
        "id": 1,
        "stage": "analyze",
        "name": "领域识别",
        "input": { "text": "..." },
        "output": { "domain": "AGENT", "confidence": 0.9 },
        "duration": 1200,
        "isKeyDecision": false
      }
    ],
    "metadata": {
      "totalSteps": 7,
      "totalDuration": 12300,
      "model": "gemini-2.0-flash-exp",
      "mode": "normalized"
    },
    "grouped": {
      "analyze": [1, 2, 3],
      "extract": [4, 5],
      "generate": [6],
      "validate": [7]
    }
  }
}
```

**Response（raw 模式，适用于 ≤2 步骤）：**
```json
{
  "data": {
    "rawSteps": [
      { "id": 1, "name": "内容提取", "input": {}, "output": {} },
      { "id": 2, "name": "结果生成", "input": {}, "output": {} }
    ],
    "metadata": {
      "totalSteps": 2,
      "totalDuration": 5000,
      "model": "gemini-2.0-flash-exp",
      "mode": "raw"
    }
  }
}
```

**兼容策略：**
- 步骤 ≤ 2：自动返回 `raw` 模式，不分组
- 步骤 > 2：返回 `normalized` 模式，按阶段分组

### 5.4 验收标准

| 验收项 | 标准 |
|-------|------|
| 步骤分组 | 按阶段正确分组展示 |
| 输入/输出 | 每步骤清晰展示输入输出 |
| 关键决策 | 决策点有明确标注 |
| 折叠/展开 | 支持默认折叠、点击展开 |
| 性能 | 大量步骤（>20）不卡顿（虚拟列表） |

---

## 6. Phase 4：处理日志与回放

### 6.1 实施方案

**目标：** 展示完整的 Agent 处理过程日志

**功能：**
1. **处理日志列表**：按时间顺序展示所有处理尝试
2. **失败原因分析**：展示失败的原因和错误信息
3. **重试历史**：展示重试次数和间隔
4. **原始输入**：保留原始输入内容（脱敏）

### 6.2 ProcessAttempt 模型（最终版 v1.3）

```prisma
model Entry {
  // 现有字段...

  // 补充反向关系
  processAttempts ProcessAttempt[] @relation("EntryProcessAttempts")
}

model ProcessAttempt {
  id                String   @id @default(cuid())
  entryId           String
  entry             Entry    @relation("EntryProcessAttempts", fields: [entryId], references: [id], onDelete: Cascade)

  // 处理信息
  attemptNumber     Int      // 尝试次数（第1次、第2次...）
  status            AttemptStatus

  // 时间
  startedAt         DateTime
  completedAt       DateTime?
  durationMs        Int?     // 耗时（毫秒）

  // 输入输出
  inputSummary      String?  // 输入摘要（脱敏）
  error             String?  // 错误信息

  // 重试链路（自引用）
  previousAttemptId String?  @unique // 上一次尝试ID
  previousAttempt   ProcessAttempt? @relation("AttemptChain", fields: [previousAttemptId], references: [id])
  nextAttempt       ProcessAttempt? @relation("AttemptChain")
  retryAfterMs      Int?     // 重试间隔（毫秒）

  createdAt         DateTime @default(now())

  // 约束
  @@unique([entryId, attemptNumber])
  @@index([entryId])
  @@index([previousAttemptId])
}

enum AttemptStatus {
  SUCCESS
  FAILED
  RUNNING
}
```

### 6.3 API 契约

**GET /api/entries/[id]/process-attempts**

Response：
```json
{
  "data": {
    "attempts": [
      {
        "id": "xxx",
        "attemptNumber": 3,
        "status": "SUCCESS",
        "startedAt": "2026-02-23T15:30:12Z",
        "completedAt": "2026-02-23T15:30:24Z",
        "durationMs": 12300,
        "error": null,
        "retryAfterMs": null
      },
      {
        "id": "yyy",
        "attemptNumber": 2,
        "status": "FAILED",
        "startedAt": "2026-02-23T14:20:05Z",
        "completedAt": "2026-02-23T14:20:08Z",
        "durationMs": 3200,
        "error": "API timeout after 3 retries",
        "retryAfterMs": 300000
      }
    ]
  }
}
```

### 6.4 脱敏策略

| 字段 | 脱敏规则 |
|-----|---------|
| URL 参数 | 仅保留域名 + 路径，参数转为 `***` |
| Token | 疑似 token 的长字符串转为 `***` |
| 个人信息 | 疑似邮箱/手机号转为 `***` |

### 6.5 验收标准

| 验收项 | 标准 |
|-------|------|
| 日志列表 | 按时间倒序列出所有处理记录 |
| 失败分析 | 失败原因清晰展示 |
| 重试展示 | 重试间隔和次数可见 |
| 原始输入 | 可查看原始输入内容（脱敏后） |
| 尝试链路 | 可追溯完整重试路径 |

---

## 7. 技术依赖

### 7.1 Phase 依赖关系

```
Phase 1 (元数据面板)
       ↓
Phase 2 (质量评估) ── Phase 3 (推理增强)
       │
       ↓
Phase 4 (处理日志)
```

---

## 8. 实施优先级

| Phase | 工作量 | 价值 | 优先级 |
|-------|-------|------|--------|
| Phase 1 | 小 | 高 | P0 |
| Phase 2 | 中 | 高 | P1 |
| Phase 3 | 小 | 中 | P2 |
| Phase 4 | 中 | 中 | P2 |

---

## 9. 风险与约束

1. **置信度数据来源**：Phase 1 依赖 Agent 输出字段级置信度，需确认 engine 是否已输出
2. **质量维度定义**：5 维度标准需与 Agent prompt 对齐，避免评估标准不一致
3. **Trace 数据量**：大量步骤时前端渲染性能需关注

---

## 10. 完整测试清单

### 10.1 API 层测试

| 测试项 | 场景 | 预期 |
|-------|------|------|
| quality 读取 | GET /api/entries/[id]/quality | 返回 5 维度 + 综合置信度 |
| quality 覆盖 | PATCH /api/entries/[id]/quality | 覆盖成功，历史记录+1 |
| quality 回滚 | PATCH + reset 标志 | 回滚到 AI 评估 |
| quality 历史 | GET /api/entries/[id]/quality/history | 返回历史记录 |
| trace 读取 | GET /api/entries/[id]/trace | 返回分组后的步骤 |
| attempts 读取 | GET /api/entries/[id]/process-attempts | 返回重试链路 |

### 10.2 UI 层测试

| 测试项 | 场景 | 预期 |
|-------|------|------|
| Tab 切换 | 点击 Overview/Summary/Trace/Quality | 内容正确切换 |
| 降级展示 | 无 fieldConfidence 时 | 显示"-"而非报错 |
| 折叠/展开 | 点击步骤 | 展开/收起详情 |
| 手动覆盖 | 修改评估值后保存 | 刷新后显示覆盖值 |

### 10.3 回归测试

| 测试项 | 验收标准 |
|-------|---------|
| 重处理 | Reprocess 按钮正常工作 |
| 智能摘要 | Smart Summary 功能不受影响 |
| 关联条目 | Related Entries 展示正常 |
| Trace 基础 | 原生 Trace 展示不退化 |

---

## 11. 评审结论

**状态**：✅ 已通过评审

本计划已根据评审意见完成以下修订：
- [x] 明确字段级置信度与来源映射结构（fieldConfidence / fieldSourceMap）
- [x] 明确手动覆盖作用域（仅展示层，不影响排序/推荐）
- [x] 新增 QualityRevision 审计表，解决 Json[] 并发风险
- [x] 定义 Trace 阶段 taxonomy（analyze/extract/generate/validate）
- [x] 明确 ProcessAttempt 模型，支撑 Phase 4
- [x] 补充脱敏策略
- [x] 增加完整测试清单

---

## 12. 二轮评审意见（2026-02-23）

### 12.1 评审结论

**结论：有条件通过（Conditional Pass）**。  
v1.1 明显提升可执行性，但仍有 1 项模型级阻断问题和 4 项高风险契约问题。

### 12.2 关键发现（按优先级）

| 优先级 | 发现 | 文档位置 | 影响 | 建议 |
|-------|------|---------|------|------|
| P0 | `Entry.qualityHistoryId + qualityHistory[]` 关系定义不合理（1:N 关系不应同时保留单值 historyId） | 4.2 | Prisma schema 设计冲突，落地易失败 | 移除 `qualityHistoryId`，仅保留 `QualityRevision.entryId -> Entry` 一对多 |
| P1 | `confidence` 口径未统一：现有系统多处为 0-1，小节示例使用 80（百分制） | 4.3.1 | 展示与计算易错位 | 固定内部口径为 0-1，UI 层格式化为百分比 |
| P1 | Trace taxonomy 为 4 阶段，但当前引擎稳定输出约 2 步，缺少映射降级规则 | 5.2, 5.3 | Phase 3 UI 可能无法按计划分组 | 增加 `step->stage` 映射表与 fallback：未知步骤归类 `analyze`/`unknown` |
| P1 | `ProcessAttempt` 缺少关键约束（`entryId+attemptNumber` 唯一、`previousAttemptId` 自关联） | 6.2 | 重试链可能断裂或重复编号 | 增加唯一约束与自引用 relation，保证链路可追溯 |
| P1 | `fieldConfidence/fieldSourceMap` 直接嵌入 `summaryStructure`，未定义与 `type/fields/reasoning` 的隔离策略 | 3.2 | 结构渲染与元数据耦合，后续维护风险高 | 放入 `summaryStructure.meta` 或单独 JSON 字段，避免污染结构字段 |
| P2 | 脱敏策略仅列规则，未定义检测边界与误判处理 | 6.4 | 可能出现漏脱敏或过度脱敏 | 增加脱敏测试样例集（URL/token/email/手机号/代码片段） |

### 12.3 本轮建议门禁

1. 先修正 `Entry <-> QualityRevision` 关系模型后再推进 API 实现。
2. 固化置信度单位（0-1）并在所有接口示例统一。
3. 为 Trace 增强补充"当前两步输出"的兼容渲染策略。
4. 为 `ProcessAttempt` 增加唯一约束和链路完整性校验测试。
5. 在上线前执行脱敏回归样例，确认无明文泄露。

---

## 13. 二轮修订（v1.2）

### 13.1 QualityRevision 关系模型修正

**问题**：`Entry.qualityHistoryId + qualityHistory[]` 关系定义不合理。

**修正方案**：移除 `qualityHistoryId`，仅保留一对多关系

```prisma
model Entry {
  // 现有字段...

  // Phase 2 新增
  qualityOverride Json?    // 用户手动覆盖的评估

  // 移除 qualityHistoryId，改为纯一对多
  qualityHistories QualityRevision[] @relation("EntryQualityHistory")
}

model QualityRevision {
  id              String   @id @default(cuid())
  entryId         String
  entry           Entry    @relation("EntryQualityHistory", fields: [entryId], references: [id], onDelete: Cascade)

  // 变更内容
  previousJson    Json     // 变更前的评估值
  newJson         Json     // 变更后的评估值
  overrideReason  String?  // 覆盖原因（用户填写）

  // 审计
  createdAt       DateTime @default(now())
  createdBy       String?  // 预留，未来支持多用户

  @@index([entryId])
}
```

### 13.2 置信度口径统一

**问题**：示例中 80% 与内部 0-1 不一致。

**解决方案**：统一为 **内部 0-1，UI 格式化为百分比**

```typescript
// 内部存储：0-1 浮点数
confidence: 0.8

// API 返回：0-1
{ "confidence": 0.8 }

// UI 展示：百分比格式化
{ "confidenceDisplay": "80%" }
```

**统一规则**：
- 数据库存储：0-1 浮点数
- API 返回：`confidence: number`（0-1 范围）
- UI 展示：`${Math.round(confidence * 100)}%`

### 13.3 Trace 兼容渲染策略

**问题**：当前引擎仅输出约 2 步，无法按 4 阶段分组。

**解决方案**：Step → Stage 映射表 + Fallback

```typescript
// Step 名称到 Stage 的映射
const stepToStageMap: Record<string, string> = {
  // analyze 阶段
  "领域识别": "analyze",
  "内容分析": "analyze",
  "类型判断": "analyze",
  "难度评估": "analyze",

  // extract 阶段
  "核心摘要提取": "extract",
  "要点提取": "extract",
  "边界提取": "extract",

  // generate 阶段
  "实践任务生成": "generate",
  "关联发现": "generate",

  // validate 阶段
  "结果验证": "validate",
  "质量检查": "validate",
};

// Fallback：未知步骤归类为 analyze
function getStage(stepName: string): string {
  return stepToStageMap[stepName] || "analyze";
}
```

**兼容渲染策略**：
1. 若步骤 ≤ 2：不分组，平铺展示
2. 若步骤 > 2：按阶段分组展示
3. UI 需兼容两种模式

### 13.4 ProcessAttempt 约束增强

**问题**：缺少唯一约束和链路追溯。

**修正方案**：

```prisma
model ProcessAttempt {
  id                String   @id @default(cuid())
  entryId           String
  entry             Entry    @relation(fields: [entryId], references: [id], onDelete: Cascade)

  // 处理信息
  attemptNumber     Int      // 尝试次数（第1次、第2次...）
  status            AttemptStatus

  // 时间
  startedAt         DateTime
  completedAt       DateTime?
  durationMs        Int?

  // 输入输出
  inputSummary      String?
  error             String?

  // 重试链路（自引用）
  previousAttemptId String?  @unique  // 上一次尝试ID（唯一，确保链不重复）
  previousAttempt   ProcessAttempt? @relation("AttemptChain", fields: [previousAttemptId], references: [id])
  nextAttempt       ProcessAttempt? @relation("AttemptChain")

  createdAt         DateTime @default(now())

  // 约束
  @@unique([entryId, attemptNumber])  // 同一 Entry 下，attemptNumber 唯一
  @@index([entryId])
  @@index([previousAttemptId])
}

enum AttemptStatus {
  SUCCESS
  FAILED
  RUNNING
}
```

**链路追溯保证**：
- `@@unique([entryId, attemptNumber])`：防止重复编号
- `previousAttemptId @unique`：确保每个 Attempt 最多有一个前驱
- 自引用 relation：支持 `previousAttempt` / `nextAttempt` 双向查询

### 13.5 字段元数据隔离策略

**问题**：fieldConfidence/fieldSourceMap 嵌入 summaryStructure 污染结构字段。

**解决方案**：放入 `summaryStructure.meta`

```typescript
// 存储结构
interface SummaryStructure {
  // 业务结构字段
  type: "problem-solution" | "concept-flow" | ...
  fields: Record<string, any>
  reasoning: string

  // 元数据（隔离）
  meta: {
    fieldConfidence: Record<string, "high" | "medium" | "low">
    fieldSourceMap: Record<string, "ai" | "user" | "system">
    extractedAt: string
    model: string
  }
}
```

**好处**：
- 业务字段与元数据分离
- 渲染时需额外读取 `meta.fieldConfidence`
- 避免污染业务数据结构

### 13.6 脱敏测试样例集

**问题**：缺少检测边界与误判处理。

**脱敏测试样例**：

| 输入 | 预期输出 | 说明 |
|-----|---------|------|
| `https://api.example.com/users?id=123&token=abc` | `https://api.example.com/users?id=***&token=***` | URL 参数脱敏 |
| `sk-abc123xyz456` | `***` | 疑似 API Token |
| `user@company.com` | `***` | 邮箱脱敏 |
| `13812345678` | `***` | 手机号脱敏 |
| `const apiKey = "sk-xxx"` | `const apiKey = "***"` | 代码中的 token |
| `console.log("debug info")` | `console.log("debug info")` | 普通日志保留 |
| `https://github.com/user/repo` | `https://github.com/user/repo` | 公开 URL 保留 |

**脱敏函数示例**：

```typescript
function sanitize(input: string): string {
  // 1. URL 参数脱敏
  let result = input.replace(/[?&][^&=]+=\w+/g, (match) => {
    return match.split('=')[0] + '=***';
  });

  // 2. Token 模式脱敏（sk-, api_key, token 等前缀）
  result = result.replace(/(sk-|api_key|token)\s*[=:]\s*["']?[\w-]+["']?/gi, '***');

  // 3. 邮箱脱敏
  result = result.replace(/[\w.-]+@[\w.-]+\.\w+/g, '***');

  // 4. 手机号脱敏
  result = result.replace(/\d{11}/g, '***');

  return result;
}
```

---

## 14. 评审结论

**状态**：✅ 已通过二轮评审

本计划已根据二轮评审意见完成以下修订：
- [x] 修正 QualityRevision 关系模型，移除不合理的 historyId
- [x] 统一置信度口径为内部 0-1，UI 格式化为百分比
- [x] 增加 Trace step→stage 映射表与兼容渲染策略
- [x] ProcessAttempt 增加唯一约束和自引用 relation
- [x] fieldConfidence/fieldSourceMap 移入 summaryStructure.meta 隔离
- [x] 增加脱敏测试样例集

---

## 15. 三轮评审意见（2026-02-23）

### 15.1 评审结论

**结论：有条件通过（Conditional Pass）**。  
v1.2 方向正确，但仍有 2 项阻断级文档冲突和 3 项高风险实现细节需要先统一。

### 15.2 关键发现（按优先级）

| 优先级 | 发现 | 文档位置 | 影响 | 建议 |
|-------|------|---------|------|------|
| P0 | `Entry/QualityRevision` 模型在 4.2 与 13.1 仍是两套定义（旧版含 `qualityHistoryId`，新版移除） | 4.2 vs 13.1 | 实施者无法确定单点真理，迁移脚本易走错 | 将 4.2 直接更新为最终版，仅保留一套模型定义 |
| P0 | 置信度口径在 4.3.1 与 13.2 仍冲突（`confidence: 80` vs `0.8`） | 4.3.1 vs 13.2 | API 契约歧义，前后端可能各自按不同单位实现 | 固定 API 单位为 0-1，并把 4.3.1 示例同步改为 `0.8` |
| P1 | `ProcessAttempt` v1.2 增强版未保留 6.2 的 `retryAfterMs` 字段，且未显式给出 `Entry.processAttempts` 反向关系 | 6.2, 13.4 | 接口与模型不一致，链路信息可能缺失 | 合并两版字段并补齐 Entry 反向 relation |
| P1 | v1.2 代码块中存在非标准引号（`""`），复制到 Prisma/TS 会直接报错 | 13.1, 13.2, 13.3, 13.4, 13.5 | 文档可执行性下降 | 统一替换为 ASCII 引号 `\"`/`'` |
| P1 | Trace 兼容策略写"步骤 ≤ 2 不分组"，但 5.3 API 仍只给分组后结构，缺少原始模式返回契约 | 5.3, 13.3 | 前端兼容分支不清晰 | 明确返回协议：`mode=raw|normalized` 或同时返回 `rawSteps + groupedSteps` |

### 15.3 本轮建议门禁

1. 先做文档"单点真理"清理：删除旧模型与旧示例，保留 v1.2 最终契约。
2. 在 schema 章节补完整 `Entry <-> ProcessAttempt` 双向关系与字段清单。
3. 给 trace API 增加兼容模式返回示例后再进入前端实现。
4. 对第 13 节全部示例执行一次"可复制语法检查"（Prisma/TS）。

---

## 16. 三轮修订（v1.3）

### 16.1 文档冲突修复

**已完成的统一：**

1. **4.2 数据库模型** → 移除 `qualityHistoryId`，仅保留 `qualityHistories` 一对多关系
2. **4.3.1 置信度示例** → 统一为 `0.8`（内部 0-1）+ 新增 `confidenceDisplay: "80%"`
3. **5.3 Trace API** → 增加 `mode=raw|normalized` 兼容模式
4. **6.2 ProcessAttempt** → 补齐 `retryAfterMs` 字段和 `Entry.processAttempts` 反向关系

### 16.2 语法修复

已修复非标准引号为 ASCII 引号（`"` / `'`）。

---

## 17. 评审结论

**状态**：✅ 已通过三轮评审

本计划已完成以下修订：
- [x] 统一 QualityRevision 关系模型（移除 qualityHistoryId）
- [x] 统一置信度口径为 0-1，API 增加 confidenceDisplay 展示字段
- [x] Trace API 增加 raw/normalized 兼容模式
- [x] ProcessAttempt 补齐字段和 Entry 反向关系
- [x] 修复代码块语法（ASCII 引号）

---

## 18. 四轮修订（v1.4）

### 18.1 元数据结构统一

将 3.2 字段级置信度与来源映射统一放入 `summaryStructure.meta`，与业务字段隔离。

### 18.2 规范优先级声明

本文档的规范优先级：
- **核心实施章节**：3~6 章（第 16 章补充）
- **历史参考章节**：11~17 章（已废弃，仅供回溯）

---

## 19. 评审结论

**状态**：✅ 已通过四轮评审

本计划已完成以下修订：
- [x] 统一元数据结构为 `summaryStructure.meta`
- [x] 增加规范优先级声明
