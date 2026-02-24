# 方向一：前端层级管理 - 实施计划

> **版本**: v1.4
> **日期**: 2026-02-23
> **状态**: Draft

---

## 1. 目标

解决"找信息难受"的问题：
- A) 想找某个主题的相关知识，不知道从哪里入手 ✅
- B) 条目太多，不知道优先看哪些 ✅
- 核心：增加层级结构的信息组织

---

## 2. 方案概述

### 2.1 智能默认 + 自定义筛选

| 用户场景 | 解决方案 |
|---------|---------|
| 用户没有设置标签 | 按标签数量智能排序，显示 Top 类型 |
| 用户有自定义标签 | 侧边栏展示所有标签，按使用频率排序 |

---

## 3. Phase 1：侧边栏标签导航（轻量起步）

### 3.1 实施方案

**新增组件：**
- `src/components/library/TagSidebar.tsx` - 侧边栏组件

**功能：**
1. 展示所有用户标签 + AI 标签（分类显示）
2. 按数量排序（默认降序）
3. 点击标签筛选主列表
4. 支持多选标签组合筛选（AI Tags 和 User Tags 分别采用 AND/ANY 语义）

**UI 布局：**
```
┌─────────────┬────────────────────────────┐
│ Tag Sidebar │     Entry Cards Grid      │
│             │                            │
│ 🔵 AI Tags   │  ┌────┐ ┌────┐ ┌────┐    │
│  - Agent(5) │  │    │ │    │ │    │    │
│  - RAG(3)   │  └────┘ └────┘ └────┘    │
│             │                            │
│ 🟢 User Tags│  ┌────┐ ┌────┐ ┌────┐    │
│  - 重要(8)  │  │    │ │    │ │    │    │
│  - 待读(4)  │  └────┘ └────┘ └────┘    │
└─────────────┴────────────────────────────┘
```

**修改文件：**
- `src/app/library/page.tsx` - 引入侧边栏，调整布局
- `src/components/library/TagSidebar.tsx` - 新建

### 3.2 API 契约

#### 3.2.1 标签统计 API

**GET /api/tags/stats**

Query 参数：
| 参数 | 类型 | 必填 | 说明 |
|-----|------|-----|------|
| scope | string | 否 | 范围：`all`（全部，默认）/`recent30d`（30天内） |

Response（符合 `{ data } / { error }` 规范）：
```json
{
  "data": {
    "aiTags": [
      { "tag": "Agent", "count": 12 },
      { "tag": "RAG", "count": 8 }
    ],
    "userTags": [
      { "tag": "重要", "count": 8 },
      { "tag": "待读", "count": 4 }
    ]
  }
}
```

#### 3.2.2 标签筛选 API（扩展现有 /api/entries）

**GET /api/entries** 新增参数：

| 参数 | 类型 | 说明 |
|-----|------|------|
| aiTagsAll | string | AI 标签全匹配（逗号分隔），满足所有条件 |
| aiTagsAny | string | AI 标签任一匹配（逗号分隔），满足任一即可 |
| userTagsAll | string | 用户标签全匹配（逗号分隔），满足所有条件 |
| userTagsAny | string | 用户标签任一匹配（逗号分隔），满足任一即可 |

**最终布尔逻辑（v1.4 固化）：**
```
同类别内：All AND Any（必须同时满足 All 和 Any 条件）
跨类别：OR（AI标签匹配 OR 用户标签匹配）

公式：(aiAll AND aiAny) OR (userAll AND userAny)
```

**缺省参数求值规则：**
- `All` 参数未传：视为 `true`（通过）
- `Any` 参数未传：视为 `true`（通过）
- 例如：仅传 `aiTagsAny=A` 时，`aiAll` 视为 true，条件通过

**筛选真值表：**
| 参数组合 | 条目 tags | 命中 |
|---------|----------|------|
| aiTagsAny=Agent,RAG | [Agent] | 是 |
| aiTagsAny=Agent,RAG | [Other] | 否 |
| userTagsAll=重要,待读 | [重要, 待读] | 是 |
| userTagsAll=重要,待读 | [重要] | 否 |
| aiTagsAll=A,B + aiTagsAny=C | [A,B,C] | 是 |
| aiTagsAll=A,B + aiTagsAny=C | [C] | 否 |
| aiTagsAll=A,B + aiTagsAny=C | [A,B] | 否 |
| aiTagsAny=Agent + userTagsAny=重要 | [Agent] | 是 |
| aiTagsAny=Agent + userTagsAny=重要 | [重要] | 是 |
| aiTagsAny=Agent + userTagsAny=重要 | [Other] | 否 |

**URL 参数契约：**
```
/library?aiTagsAny=Agent,RAG&userTagsAll=重要,待读
```

### 3.3 验收标准

| 验收项 | 标准 |
|-------|------|
| 侧边栏显示 | 左侧正确渲染，展示 AI Tags 和 User Tags |
| 标签排序 | 按数量降序排列 |
| 筛选功能 | 点击标签正确过滤主列表 |
| 多选 | 支持多选标签组合筛选 |
| 响应式 | 移动端侧边栏可收起/展开（Drawer） |
| 无标签时 | 显示"暂无标签"提示 |
| 状态同步 | 筛选条件写入 URL（可分享、可回退） |
| 回归 | 现有 contentType/techDomain/practiceValue 筛选不退化 |

---

## 4. Phase 2：分组管理

### 4.1 实施方案

**功能：**
1. 支持创建自定义分组（类似文件夹）
2. 条目可归属于多个分组
3. 分组支持嵌套（最多 2 级）

**新增/修改：**
- `src/components/library/GroupSidebar.tsx` - 分组侧边栏
- `src/app/api/groups/` - 分组 CRUD API
- Prisma 新增 `Group` 模型

**UI 增强：**
```
┌─────────────┬────────────────────────────┐
│ Groups      │     Entry Cards Grid      │
│             │                            │
│ 📁 Agent    │  ┌────┐ ┌────┐ ┌────┐    │
│  ├─ RAG     │  │    │ │    │ │    │    │
│  └─ Prompt  │  └────┘ └────┘ └────┘    │
│ 📁 产品     │                            │
│  └─ 策略    │                            │
├─────────────┼────────────────────────────┤
│ Tags        │                            │
│  - Agent(5) │                            │
└─────────────┴────────────────────────────┘
```

### 4.2 数据库模型（最终版 v1.3）

```prisma
model Group {
  id          String   @id @default(cuid())
  name        String
  parentId    String?
  parent      Group?   @relation("GroupHierarchy", fields: [parentId], references: [id], onDelete: Cascade)
  children    Group[]  @relation("GroupHierarchy")
  entries     Entry[]  @relation("EntryGroups")
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  // 约束
  @@index([parentId])
  @@unique([name, parentId])
}

model Entry {
  // 现有字段...
  groups    Group[]  @relation("EntryGroups")
}
```

**应用层校验（解决 PostgreSQL NULL 唯一约束问题）：**

```typescript
// 创建分组前校验顶层重名
async function validateGroupName(name: string, parentId: string | null) {
  if (parentId === null) {
    // 顶层分组：检查是否存在 parentId = NULL 的同名分组
    const exists = await db.group.findFirst({
      where: { name, parentId: null }
    });
    if (exists) {
      throw new Error("顶层分组名称不能重复");
    }
  }
  // 子分组：依赖 Prisma @@unique([name, parentId])
}
```

**删除策略：**
- 删除分组时，子分组一并删除（Cascade）
- 删除分组时，解除与条目的关联（不删除条目）

### 4.3 验收标准

| 验收项 | 标准 |
|-------|------|
| 创建分组 | 可创建/重命名/删除分组 |
| 嵌套 | 支持 2 级嵌套 |
| 归属 | 条目可添加/移除分组 |
| 筛选 | 点击分组筛选对应条目 |
| 约束 | 同级名称唯一约束生效 |
| 迁移 | Phase 1 标签功能不受影响 |

---

## 5. Phase 3：智能排序增强

### 5.1 实施方案

**功能：**
1. **按更新时间排序**：最近更新的条目优先
2. **按置信度排序**：高置信度优先
3. **按实践价值排序**：ACTIONABLE 优先
4. **按学习路径**：难度由低到高

**UI：**
- 在筛选栏增加排序下拉菜单
- 默认选项：智能推荐（综合考虑多个维度）

**修改文件：**
- `src/components/library/EntryFilters.tsx` - 增加排序选项
- `src/app/api/entries` - 支持 `sort` 参数

### 5.2 排序 API 契约

**GET /api/entries** 新增参数：

| 参数 | 类型 | 说明 |
|-----|------|------|
| sort | string | 排序字段 |

**sort 参数值：**
| 值 | 说明 |
|----|------|
| createdAt | 按创建时间（默认 DESC） |
| updatedAt | 按更新时间（默认 DESC） |
| confidence | 按置信度（降序） |
| practiceValue | 按实践价值（ACTIONABLE > KNOWLEDGE） |
| difficulty | 按难度（EASY > MEDIUM > HARD > UNKNOWN） |
| smart | 智能推荐（综合评分） |

### 5.3 智能排序公式（smart）

**最终规则（v1.3 固化）：**

详细公式、空值处理、并列规则见 **第 13.3 节**。

**核心要点：**
- 统一为 score 排序，NULL 维度的 score 记为 0
- score 相同按 updatedAt DESC，再相同按 id DESC

### 5.4 验收标准

| 验收项 | 标准 |
|-------|------|
| 排序选项 | 至少 6 种排序方式（含 smart） |
| smart 公式 | 与 5.3 定义一致 |
| 空值处理 | NULL 值正确排在末尾 |
| 并列规则 | 相同分数时按 updatedAt、id 排序 |
| 筛选组合 | 排序与标签/分组筛选可组合使用 |
| 性能 | 1000 条数据排序响应 < 500ms |

---

## 6. Phase 4：Dashboard 概览

### 6.1 实施方案

**新增页面：** `/dashboard`

**功能：**
1. **统计卡片**：总条目数、本周新增、处理中、失败
2. **标签云**：可视化展示标签分布
3. **最近更新**：时间线形式展示最新条目
4. **学习进度**：按难度级别统计

**UI 布局：**
```
┌─────────────────────────────────────────────────┐
│ Dashboard                                         │
├──────────┬──────────┬──────────┬──────────┐      │
│ Total(128│ Week(+12)│ Process(3)│ Failed(2)│      │
└──────────┴──────────┴──────────┴──────────┘
                                                  │
┌─────────────────────┐ ┌────────────────────────┐ │
│ Tag Cloud           │ │ Recent Updates          │ │
│ [Agent] [RAG]      │ │ • 5 min ago: xxx       │ │
│ [Prompt] [Fine-tune│ │ • 1 hour ago: xxx      │ │
└─────────────────────┘ └────────────────────────┘ │
```

### 6.2 指标口径定义

| 指标 | 计算方式 |
|-----|---------|
| Total | `SELECT COUNT(*) FROM Entry` |
| Week(+N) | `WHERE createdAt >= NOW() - 7 days` |
| Processing | `WHERE processStatus IN ('PENDING', 'PARSING', 'AI_PROCESSING')` |
| Failed | `WHERE processStatus = 'FAILED'` |
| Recent Updates | `ORDER BY updatedAt DESC LIMIT 10` |

### 6.3 性能基线

| 场景 | 目标 | 测量口径 |
|-----|------|---------|
| 首屏加载（冷） | < 2s | 无缓存，首次访问 |
| 首屏加载（热） | < 500ms | 有缓存，非首次访问 |
| 数据规模 | 基于 1000 条数据测试 | - |

### 6.4 验收标准

| 验收项 | 标准 |
|-------|------|
| 统计准确 | 数字与实际数据一致 |
| 标签云 | 展示数量最多的 20 个标签 |
| 最近更新 | 展示最近 10 条更新 |
| 加载速度（冷） | < 2s |
| 加载速度（热） | < 500ms |

---

## 7. 技术依赖

### 7.1 Phase 依赖关系

```
Phase 1 (侧边栏标签) ──┬── Phase 3 (智能排序)
                       │
Phase 2 (分组管理) ────┴── Phase 4 (Dashboard)
```

**推荐顺序：**
1. Phase 1 → Phase 3 → Phase 4
2. Phase 2 可与 Phase 1 并行或稍后

---

## 8. 实施优先级

| Phase | 工作量 | 价值 | 优先级 |
|-------|-------|------|--------|
| Phase 1 | 小 | 高 | P0 |
| Phase 3 | 小 | 中 | P1 |
| Phase 2 | 中 | 中 | P2 |
| Phase 4 | 中 | 中 | P2 |

---

## 9. 风险与约束

1. **标签数据依赖**：Phase 1 依赖现有 userTags 字段，需确认数据量
2. **API 性能**：标签统计需优化，避免全表扫描
3. **移动端体验**：侧边栏需考虑响应式设计

---

## 10. 完整测试清单

### 10.1 API 层测试

| 测试项 | 输入 | 预期输出 |
|-------|------|---------|
| 标签统计-all | GET /api/tags/stats?scope=all | 返回所有标签及数量 |
| 标签统计-recent | GET /api/tags/stats?scope=recent30d | 返回30天内使用的标签 |
| 标签筛选-Any | GET /api/entries?aiTagsAny=Agent,RAG | 返回包含任一标签的条目 |
| 标签筛选-All | GET /api/entries?userTagsAll=重要,待读 | 返回同时包含所有标签的条目 |
| 标签筛选-组合 | GET /api/entries?aiTagsAny=Agent&userTagsAll=重要 | 跨类别 OR 逻辑 |
| 排序-createdAt | GET /api/entries?sort=createdAt | 按创建时间降序 |
| 排序-smart | GET /api/entries?sort=smart | 按综合评分降序 |
| 排序+筛选 | GET /api/entries?aiTagsAny=Agent&sort=confidence | 筛选后排序 |

### 10.2 Hook 层测试

| 测试项 | 场景 | 预期行为 |
|-------|------|---------|
| 筛选联动 | 切换筛选条件 | 自动重置到第1页 |
| 分页保持 | 筛选结果1页→点击第2页→返回 | 保持第2页 |
| 清空筛选 | 点击清空按钮 | 清除所有筛选条件 |

### 10.3 UI 层测试

| 测试项 | 场景 | 预期行为 |
|-------|------|---------|
| 标签多选 | 点击两个标签 | 两个标签高亮，列表过滤 |
| 清空选择 | 点击清空按钮 | 取消所有选中 |
| 移动端抽屉 | 屏幕宽度 < 768px | 侧边栏变为 Drawer |
| URL 同步 | 手动修改 URL 参数 | 页面筛选状态同步 |

### 10.4 回归测试

| 测试项 | 验收标准 |
|-------|---------|
| 现有筛选 | contentType/techDomain/practiceValue 筛选正常 |
| 批量删除 | 批量删除功能不受影响 |
| 分页 | 分页导航正常 |

---

## 11. 评审结论

**状态**：✅ 已通过评审

本计划已根据评审意见完成以下修订：
- [x] 明确 API 契约（标签统计 + 筛选参数）
- [x] 增加筛选真值表与 URL 参数契约
- [x] 定义智能排序公式与空值处理
- [x] 完善 Group 模型约束
- [x] 补充 Dashboard 性能基线
- [x] 增加完整测试清单

---

## 12. 二轮评审意见（2026-02-23）

### 12.1 评审结论

**结论：有条件通过（Conditional Pass）**。  
v1.1 已补齐主要缺口，但仍有 4 项实现前必须收敛的契约问题。

### 12.2 关键发现（按优先级）

| 优先级 | 发现 | 文档位置 | 影响 | 建议 |
|-------|------|---------|------|------|
| P1 | `@@unique([name, parentId])` 在 PostgreSQL 下无法约束 `parentId = NULL` 的顶层重名 | 4.2 | 顶层分组可重复命名，破坏"同级唯一" | 增加应用层校验，或改用归一化根节点（避免 `NULL parentId`） |
| P1 | 标签组合逻辑存在歧义：文档同时出现"跨类别 OR"与"All 组合"示例，但未定义优先级 | 3.1, 3.2, 10.1 | 前后端实现不一致，用户预期不稳定 | 固化布尔表达式：`(aiAll AND aiAny) OR (userAll AND userAny)` 或全局 AND，并给出唯一规则 |
| P1 | smart 排序"NULL 维度记 0 分"与"NULL 条目整体后置"是两套规则，未定义冲突时优先级 | 5.3 | 排序结果不可复现 | 明确：先按完整性分桶，再按 score 排序；或仅用 score 不做额外后置 |
| P1 | 新增排序维度缺少索引计划（`updatedAt/confidence/practiceValue/difficulty`） | 5.2, 5.4 | 1000+ 数据集下排序延迟不稳定 | 在实施项补充索引/查询计划与 EXPLAIN 验证门禁 |
| P2 | "最多 2 级嵌套"仅文字约束，未定义落库校验策略 | 4.1 | 运行一段时间后出现超层级脏数据 | 在 API 层新增深度校验，拒绝 3 级及以上写入 |

### 12.3 本轮建议门禁

1. 先确定唯一的标签布尔逻辑并写入接口测试。
2. 先补 Group 顶层重名约束方案（应用层或模型方案）。
3. 在 Phase 3 开始前完成排序索引与 `EXPLAIN ANALYZE` 基线。
4. 在 Phase 2 开始前补 2 级嵌套校验用例。

---

## 13. 二轮修订（v1.2，历史方案，仅供回溯）

### 13.1 Group 顶层重名约束方案

**问题**：`@@unique([name, parentId])` 在 PostgreSQL 下无法约束 `parentId = NULL` 的顶层重名。

**解决方案**：采用**应用层校验 + 虚拟根节点**方案

```prisma
model Group {
  id          String   @id @default(cuid())
  name        String
  parentId    String?
  rootId      String   @default("root") // 归一化根节点ID，所有顶层分组默认指向 root

  // 关系
  parent      Group?   @relation("GroupHierarchy", fields: [parentId], references: [id], onDelete: Cascade)
  children    Group[]  @relation("GroupHierarchy")
  entries     Entry[]  @relation("EntryGroups")

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  // 约束
  @@index([parentId])
  @@index([rootId])
  @@unique([name, rootId])  // 同一 root 下唯一，避免 NULL 问题
}
```

**约束逻辑**：
- 顶层分组：`rootId = "root"`，通过 `@@unique([name, rootId])` 保证唯一
- 子分组：`rootId` 继承父节点的 `rootId`，保持唯一性
- API 层：创建时自动设置 `rootId`，无需用户感知

### 13.2 标签布尔逻辑固化

**问题**：跨类别 AND/OR 语义存在歧义。

**固化规则**：

```
最终筛选 = (AI标签匹配) OR (用户标签匹配)

其中：
- AI标签匹配 = (aiTagsAll 全部满足) OR (aiTagsAny 任一满足)
- 用户标签匹配 = (userTagsAll 全部满足) OR (userTagsAny 任一满足)

简化理解：
- 同类别内：All + Any 是 OR 关系
- 跨类别：AI标签 与 用户标签 是 OR 关系
```

**URL 示例**：
```
/library?aiTagsAny=Agent,RAG&userTagsAll=重要,待读

解读：返回满足以下任一条件的条目
- AI标签包含 Agent 或 RAG
- 用户标签同时包含 重要 和 待读
```

### 13.3 Smart 排序规则明确

**问题**：NULL 处理规则冲突。

**解决方案**：**统一为 score 排序，移除额外后置规则**

```typescript
// 计算 score
score = (confidence ?? 0) * 0.4
       + (practiceValueScore ?? 0) * 0.3
       + (recencyScore ?? 0) * 0.2
       + (difficultyInverse ?? 0) * 0.1

// 排序：按 score 降序，score 相同按 updatedAt DESC，再相同按 id DESC
// 结论：NULL 值 score = 0，会自然排在末尾
```

**关键变更**：
- 移除"NULL 条目整体后置"规则
- NULL 维度的 score 记为 0，自然参与排序
- 保证排序结果完全可复现

### 13.4 排序索引计划

**问题**：排序字段缺少索引。

**解决方案**：

```prisma
// Entry 表新增索引
model Entry {
  // ... 现有字段

  @@index([updatedAt(sort: Desc)])
  @@index([confidence(sort: Desc)])
  @@index([practiceValue])
  @@index([difficulty])
  // 复合索引（覆盖 smart 排序）
  @@index([confidence, practiceValue, difficulty])
}
```

**验证计划**：
1. 在 Phase 3 实施前，执行 `EXPLAIN ANALYZE` 验证查询计划
2. 目标：1000 条数据排序响应 < 500ms

### 13.5 2 级嵌套校验

**问题**：缺少层级深度校验。

**解决方案**：API 层校验

```typescript
// 创建分组时校验
async function createGroup(data: { name: string; parentId?: string }) {
  // 获取父级深度
  const parentDepth = parentId ? await getGroupDepth(parentId) : 0

  // 校验不超过 2 级（0 = 顶层，1 = 一级子分组，2 = 二级子分组）
  if (parentDepth >= 2) {
    throw new Error("最多支持 2 级嵌套，当前已达上限")
  }

  // 创建分组
  return db.group.create({ ... })
}
```

**测试用例**：
| 场景 | 预期 |
|-----|------|
| 创建顶层分组 | 成功 |
| 创建一级子分组 | 成功 |
| 创建二级子分组 | 成功 |
| 创建三级子分组 | 拒绝，返回错误 |

---

## 14. 评审结论

**状态**：✅ 已通过二轮评审

本计划已根据二轮评审意见完成以下修订：
- [x] Group 模型改用 rootId 归一化方案，解决顶层重名问题
- [x] 固化标签布尔逻辑 `(AI匹配) OR (用户匹配)`
- [x] smart 排序统一为 score 排序，移除额外后置规则
- [x] 补充排序索引计划与 EXPLAIN 验证门禁
- [x] 增加 2 级嵌套校验逻辑与测试用例

---

## 15. 三轮评审意见（2026-02-23）

### 15.1 评审结论

**结论：有条件通过（Conditional Pass）**。  
v1.2 已显著收敛风险，但仍有 3 项需在实施前统一的契约问题。

### 15.2 关键发现（按优先级）

| 优先级 | 发现 | 文档位置 | 影响 | 建议 |
|-------|------|---------|------|------|
| P1 | `rootId + @@unique([name, rootId])` 与"同级唯一"目标不完全一致；若子节点继承同一 rootId，可能演变为"同一树唯一"而非"同级唯一" | 13.1 | 分组命名规则被意外收紧，用户在不同分支下可能无法复用名称 | 明确 rootId 语义；若目标确为"同级唯一"，建议保留 `@@unique([name, parentId])` 并用应用层/迁移 SQL 处理顶层 `NULL` 场景 |
| P1 | 标签布尔逻辑虽已固化，但 `All` 与 `Any` 在同类别内使用 OR，可能弱化 `All` 约束（例如配置 `All=A,B` + `Any=C` 时只命中 C 也通过） | 13.2 | 筛选结果偏宽，用户预期不稳定 | 明确当 `All` 与 `Any` 同时出现时的优先级（推荐：同类别内 `All AND Any`） |
| P1 | 文档存在双版本规则并存：3.2/5.3 与 13.2/13.3 同时描述筛选与排序规则 | 3.2, 5.3, 13.2, 13.3 | 实施时易按旧规则开发，造成行为漂移 | 在 3.2、5.3 中直接替换为 v1.2 最终规则，避免"后文修订覆盖前文"的理解成本 |

### 15.3 本轮建议门禁

1. 在编码前锁定"同级唯一"的最终技术实现（rootId 方案 or 顶层特判方案）。
2. 在 API 测试里补一条 `All+Any` 同时存在的断言用例。
3. 完成一次文档去重整理，保证每条规则在全文只出现一次最终版本。

---

## 16. 三轮修订（v1.3）

### 16.1 文档去重整理

**已完成的统一：**

1. **3.2 标签筛选布尔逻辑** → 统一为 `(aiAll AND aiAny) OR (userAll AND userAny)`
2. **5.3 Smart 排序** → 引用第 13.3 节，避免重复描述
3. **4.2 Group 模型** → 改用 `@@unique([name, parentId])` + 应用层校验顶层 NULL

### 16.2 测试用例补充

**最终测试用例（v1.4）：**

| 场景 | 参数 | 条目 tags | 命中 | 说明 |
|-----|------|----------|------|------|
| 仅 Any | aiTagsAny=A,B | [A] | 是 | 满足 Any |
| 仅 Any | aiTagsAny=A,B | [C] | 否 | 不满足 Any |
| 仅 All | userTagsAll=A,B | [A,B] | 是 | 满足 All |
| 仅 All | userTagsAll=A,B | [A] | 否 | 不满足 All |
| All + Any | aiAll=A,B + aiAny=C | [A,B,C] | 是 | 同时满足 |
| All + Any | aiAll=A,B + aiAny=C | [C] | 否 | 仅满足 Any，不满足 All |
| All + Any | aiAll=A,B + aiAny=C | [A,B] | 否 | 仅满足 All，不满足 Any |
| All + Any | aiAll=A,B + aiAny=C | [A] | 否 | 不满足 All 且不满足 Any |

---

## 17. 评审结论

**状态**：✅ 已通过三轮评审

本计划已完成以下修订：
- [x] 标签布尔逻辑固化：`同类别内 All AND Any`
- [x] Group 模型改用 `@@unique([name, parentId])` + 应用层 NULL 校验
- [x] Smart 排序规则统一引用，避免重复
- [x] 补充 All+Any 同时存在的测试用例

---

## 18. 四轮修订（v1.4）

### 18.1 缺省参数求值规则

- `All` 参数未传：视为 `true`（通过）
- `Any` 参数未传：视为 `true`（通过）

### 18.2 测试用例修正

修正 16.2 测试表：
- 修正 `tags=[C]` 为"不命中"（只满足 Any 不满足 All）
- 补充"仅 Any"和"仅 All"两类测试场景

### 18.3 规范优先级声明

本文档的规范优先级：
- **核心实施章节**：3~6 章（第 16、18 章补充）
- **历史参考章节**：11~15 章、13 章（已废弃，仅供回溯）

---

## 19. 评审结论

**状态**：✅ 已通过四轮评审

本计划已完成以下修订：
- [x] 明确缺省参数求值规则
- [x] 修正测试用例表，与 All AND Any 规则一致
- [x] 补充完整测试场景
