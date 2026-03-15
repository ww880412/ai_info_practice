# /comparison 页面重构方案：批次聚合 → 条目级对比视图

> 状态：方案通过，待实施 | 日期：2026-03-14
> Codex R1 评审：2 P0 + 7 P1 + 3 P2，已全部在方案中处理
> Codex R2 评审：方案设计无新 P0；代码未落地属预期（方案阶段）；P2 补路由测试已采纳

## 1. 问题定义

当前 `/comparison` 页面以 `ComparisonBatch` 为粒度展示（一张卡片 = 一个批次），但用户核心操作是逐条审阅对比结果。批次是执行概念，不是用户心智模型。

**现状**：用户需要 点击批次卡片 → 进入批次详情 → 再找到具体 entry 的对比结果，路径过长。

**目标**：`/comparison` 页面直接展示 `ModeComparison` 级别的卡片（一张卡片 = 一条 entry 的对比结果），支持 filter 和分页。

## 2. 数据模型分析

### 现有关系

```
ComparisonBatch (status, sourceMode, targetMode, entryIds[])
  └── ModeComparison (batchId, entryId, originalMode, comparisonMode, winner, scoreDiff)
        └── Entry (title, url, contentType)
```

关键约束：
- `ModeComparison` 与 `ComparisonBatch` 无 Prisma relation（只有 `batchId` 字符串字段）
- `status` 仅存在于 `ComparisonBatch` 上
- `ModeComparison` 有 `entry` relation（可直接 join Entry）

### 两步 Join 策略（status 过滤）

```sql
-- Step 1: 获取符合条件的 batchIds
SELECT id FROM ComparisonBatch WHERE status = ?

-- Step 2: 用 batchIds 过滤 ModeComparison
SELECT * FROM ModeComparison WHERE batchId IN [...] AND other_filters
```

## 3. 方案设计

### 3.1 新增类型 `GlobalComparisonItem`

```typescript
// src/types/comparison.ts（独立文件，不混入 types/index.ts 的 Prisma re-export）
export interface GlobalComparisonItem {
  // 来自 ModeComparison
  id: string;           // ModeComparison.id
  createdAt: string;    // ISO 8601
  batchId: string;
  originalMode: string;   // 'two-step' | 'tool-calling'（小写，API 层统一映射）
  comparisonMode: string; // 'two-step' | 'tool-calling'
  winner: string | null;  // 'original' | 'comparison' | 'tie'
  scoreDiff: number;
  originalOverallScore: number | null;   // 从 JSON 解析提取
  comparisonOverallScore: number | null; // 从 JSON 解析提取
  // 来自 Entry join
  entryId: string;
  entryTitle: string | null;
  // 来自 ComparisonBatch batch lookup
  batchStatus: string;  // 'COMPLETED' | 'FAILED'（本次只返回已完成的）
}
```

**R1 修复**：
- 独立文件 `src/types/comparison.ts`，不污染 `types/index.ts`（P2-12）
- `overallScore` 从 `number?` 改为 `number | null`，明确 JSON 解析责任在 query 层（P1-7）

### 3.2 新增查询函数 `queryComparisons()`

文件：`src/lib/comparison/query-comparisons.ts`

```typescript
interface QueryComparisonsParams {
  limit: number;
  offset: number;
  status?: BatchStatus;        // 需两步 join
  originalMode?: string;       // ModeComparison 直接过滤
  comparisonMode?: string;     // ModeComparison 直接过滤
  winner?: string;             // ModeComparison 直接过滤
  sort?: 'createdAt';
  order?: 'asc' | 'desc';
  from?: string;               // createdAt 范围
  to?: string;
}

interface QueryComparisonsResult {
  comparisons: GlobalComparisonItem[];
  total: number;
}
```

实现要点：
- 当有 `status` 过滤时，先查 `ComparisonBatch.findMany({ where: { status }, select: { id: true } })` 获取 batchIds
- 然后用 `batchId: { in: batchIds }` 过滤 ModeComparison
- 无 status 过滤时直接查 ModeComparison
- `findMany` + `count` 并行（参考 `query-batches.ts`）
- join Entry 取 title：`entry: { select: { title: true } }`
- join ComparisonBatch 取 status：单独批量查询 batchIds → status map（避免 N+1）
- **稳定排序**：`orderBy: [{ createdAt: order }, { id: 'desc' }]`（P1-4）
- **JSON 解析**：从 `originalScore`/`comparisonScore` JSON 中提取 `overallScore`，参考 `entries/[id]/comparisons/route.ts:130` 的解析逻辑（P1-7）
- **枚举映射**：`ModeComparison.originalMode` 存储小写 `'two-step'`，`ComparisonBatch.sourceMode` 存储枚举 `TWO_STEP`；query 层统一输出小写格式，filter 参数接受小写（P1-5）
- **status 过滤范围**：本次只支持 `COMPLETED` 和 `FAILED`，不支持 `PENDING`/`PROCESSING`（因为这些状态下 ModeComparison 可能未生成）（P1-8）

### 3.3 新增 API Route

文件：`src/app/api/comparisons/route.ts`（P2-10：简化路径，与 `/api/comparison/batches` 平级）

```
GET /api/comparisons?limit=20&offset=0&status=COMPLETED&winner=original
```

- Zod 校验 searchParams（参考现有 `entries/[id]/comparisons/route.ts` 的模式）
- 返回格式统一（P1-6）：
  ```json
  {
    "data": {
      "comparisons": GlobalComparisonItem[],
      "pageInfo": {
        "total": number,
        "limit": number,
        "offset": number,
        "hasNext": boolean,
        "nextOffset": number | null
      }
    }
  }
  ```
- 错误格式：`{ "error": string }`

### 3.4 新增 Hook `useGlobalComparisons`

文件：`src/hooks/useGlobalComparisons.ts`

- `useState` + fetch 模式（沿用 BatchHistoryList 的 append 分页，不引入 useInfiniteQuery）
- 接收 filter state，变化时重置列表重新请求
- **AbortController**：filter 变更时取消旧请求，防止旧结果回写（P1-9）
- 暴露 `{ comparisons, total, isLoading, error, loadMore, setFilters }`

### 3.5 新建列表组件 `ComparisonHistoryList`

文件：`src/components/comparison/ComparisonHistoryList.tsx`（**新文件**）

**R1 修复**：不再复用 `BatchHistoryList.tsx`，保留原文件不动，避免破坏 `BatchCard` 的 `SerializedBatch` 类型导入（P0-2）

- Props：`{ initialComparisons: GlobalComparisonItem[], initialTotal: number }`
- 渲染 `GlobalComparisonCard`（新组件，见 3.6）
- 顶部 filter bar：
  - Status 下拉（All / Completed / Failed）— 不含 Pending/Processing（P1-8）
  - Winner 下拉（All / Original / Comparison / Tie）
  - Mode 下拉（All / Two-step vs Tool-calling / Tool-calling vs Two-step）
- 保留 load-more 按钮和 "Showing X of Y" 计数

### 3.6 新建 `GlobalComparisonCard` 组件

文件：`src/components/comparison/GlobalComparisonCard.tsx`（**新文件**）

**R1 修复**：不复用 `ComparisonCard`，因为数据形状不同（P0-1）：
- `ComparisonCard` 依赖 `ComparisonHistoryItem`（含 `batchCreatedAt`/`processedAt`/`resultId`）
- `GlobalComparisonCard` 使用 `GlobalComparisonItem`（含 `entryTitle`/`entryId`）

卡片内容：
- 顶部：entry 标题（链接到 `/entry/{entryId}`），fallback "未命名条目"
- 中间：mode 对比（originalMode vs comparisonMode）、分数对比、winner badge
- 底部：创建时间、batch status badge
- 点击整卡进入 `/comparison/{batchId}`

### 3.7 修改 comparison page

文件：`src/app/comparison/page.tsx`

- server component 初始数据从 `queryBatches()` 改为 `queryComparisons()`
- 序列化后传递给 `ComparisonHistoryList`（新组件）

## 4. 不动的文件

| 文件 | 原因 |
|------|------|
| `BatchCard.tsx` | batch detail 页面可能复用，且依赖 `SerializedBatch` 类型 |
| `BatchHistoryList.tsx` | 保留原组件和 `SerializedBatch` 类型导出，避免破坏 `BatchCard`（P0-2） |
| `src/app/api/comparison/batches/route.ts` | 有测试覆盖，batch detail 页面使用 |
| `src/app/comparison/[batchId]/page.tsx` | batch detail 页面不变 |
| `useComparisonHistory.ts` | entry detail 页面使用 |
| `ComparisonCard.tsx` | entry detail 页面使用，数据形状不同不复用（P0-1） |
| `query-batches.ts` | batch API 依赖 |

## 5. 改动文件清单

| # | 文件 | 操作 | 说明 |
|---|------|------|------|
| 1 | `src/types/comparison.ts` | 新建 | `GlobalComparisonItem` 类型（P2-12） |
| 2 | `src/lib/comparison/query-comparisons.ts` | 新建 | 查询函数（含 JSON 解析、枚举映射） |
| 3 | `src/app/api/comparisons/route.ts` | 新建 | API endpoint（P2-10 简化路径） |
| 4 | `src/hooks/useGlobalComparisons.ts` | 新建 | 客户端 hook（含 AbortController） |
| 5 | `src/components/comparison/ComparisonHistoryList.tsx` | 新建 | 列表组件 + filter bar（P0-2） |
| 6 | `src/components/comparison/GlobalComparisonCard.tsx` | 新建 | 卡片组件（P0-1） |
| 7 | `src/app/comparison/page.tsx` | 修改 | 切换数据源和组件 |

## 6. 风险评估

| 风险 | 影响 | 缓解 |
|------|------|------|
| 两步 join 性能 | status 过滤时多一次查询 | ComparisonBatch 数量有限（<100），可接受；中期加 relation（P1-3） |
| 新组件与现有组件并存 | 代码量增加 | 数据形状不同，强行复用更危险；后续可统一 |
| 枚举/字符串映射 | filter 无效 | query 层统一映射，API 参数文档化（P1-5） |

## 7. 验证标准

1. `npm run type-check` 通过
2. `npm run lint` 通过
3. `/comparison` 页面：每张卡片显示单条 entry 对比结果（标题、分数、winner）
4. Filter 下拉可用（status: Completed/Failed、winner、mode）
5. Load more 分页正常，无重复/丢失
6. `/comparison/{batchId}` batch detail 页面不受影响
7. Entry detail 页面的 ComparisonCard 不受影响
8. `BatchHistoryList.tsx` 和 `BatchCard.tsx` 编译正常

## 8. Codex R1 评审处理记录

| # | 级别 | 问题 | 处理 |
|---|------|------|------|
| P0-1 | 必须 | GlobalComparisonItem 与 ComparisonCard 类型不兼容 | 新建 GlobalComparisonCard，不复用 |
| P0-2 | 必须 | 重构 BatchHistoryList 会破坏 BatchCard 类型导入 | 新建 ComparisonHistoryList，保留原文件 |
| P1-3 | 延后 | 两步 join 加 relation | 需 schema migration，本次不做 |
| P1-4 | 采纳 | 稳定排序 | createdAt + id 双字段排序 |
| P1-5 | 采纳 | 枚举映射 | API 层统一小写输出 |
| P1-6 | 采纳 | pageInfo 格式统一 | 含 limit/offset/hasNext/nextOffset |
| P1-7 | 采纳 | overallScore JSON 解析 | query 层提取 |
| P1-8 | 采纳 | PENDING/PROCESSING 状态无数据 | filter 只展示 COMPLETED/FAILED |
| P1-9 | 采纳 | 旧请求回写 | AbortController |
| P2-10 | 采纳 | endpoint 命名冗余 | 改为 /api/comparisons |
| P2-11 | 延后 | React Query | 本次沿用 useState + fetch |
| P2-12 | 采纳 | 类型文件独立 | src/types/comparison.ts |
