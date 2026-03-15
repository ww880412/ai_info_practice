# 对比历史快照修复方案

> 日期：2026-03-14
> 状态：待实施

## 1. 需求概述

对比历史页面（`/comparison`）存在三个问题：

1. **BatchCard 信息量不足**：当前只展示 sourceMode/targetMode、状态、entries 数、win rate、avg score diff，用户无法快速识别一个 batch 处理的是哪些内容。
2. **API 响应格式与组件不匹配**：API 返回 `data.pageInfo.total`，但 `BatchHistoryList` 的 `loadMore` 读取的是 `data.data.total`（不存在），导致 Load More 后 `total` 被 `undefined` 覆盖，`hasMore` 计算失效。
3. **点击跳转**：`BatchCard` 已用 `<Link href="/comparison/${batch.id}">` 包裹整卡，跳转本身无问题，但需确认详情页路由参数解析正常。

---

## 2. 现状分析

### 2.1 BatchCard 当前展示字段

| 字段 | 来源 |
|------|------|
| sourceMode → targetMode | `batch.sourceMode / targetMode` |
| 状态 badge | `batch.status` |
| Entries 数 | `batch.entryCount` |
| Win Rate | `batch.winRate` |
| Avg Score Diff | `batch.avgScoreDiff` |
| 创建时间 | `batch.createdAt` |

缺失：条目标题预览、winner 分布（source 赢了几条 / target 赢了几条 / 平局）。

### 2.2 API 格式不匹配（Bug）

**API 实际返回**（`src/app/api/comparison/batches/route.ts`）：
```json
{
  "data": {
    "batches": [...],
    "pageInfo": { "total": 42, "limit": 10, "offset": 0, "hasNext": true, "nextOffset": 10 }
  }
}
```

**组件读取**（`BatchHistoryList.loadMore`，第 ~45 行）：
```ts
setTotal(data.data.total);  // undefined！正确路径是 data.data.pageInfo.total
```

**后果**：Load More 后 `total` 变为 `undefined`，`hasMore = batches.length < undefined` 为 `false`，Load More 按钮消失。

### 2.3 点击跳转

`BatchCard` 用 `<Link href={`/comparison/${batch.id}`}>` 包裹整卡，路由正确。
详情页 `src/app/comparison/[batchId]/page.tsx` 用 `useParams<{ batchId: string }>()` 读取参数，无问题。

### 2.4 query-batches 当前 select

`src/lib/comparison/query-batches.ts` 的 `prisma.comparisonBatch.findMany` 未 include 关联的 `ModeComparison` 记录，因此无法获取条目标题和 winner 分布。

---

## 3. 方案设计

### 3.1 修复 API 格式不匹配（优先级：高）

**改动文件**：`src/components/comparison/BatchHistoryList.tsx`

将 `loadMore` 中的：
```ts
setTotal(data.data.total);
```
改为：
```ts
setTotal(data.data.pageInfo.total);
```

同时更新 `initialTotal` 的初始化逻辑保持一致（SSR 路径直接用 `result.total`，无需改动）。

### 3.2 BatchCard 信息增强

#### 3.2.1 数据层：扩展 query-batches

**改动文件**：`src/lib/comparison/query-batches.ts`

在 `prisma.comparisonBatch.findMany` 的 `select` 中增加：
```ts
comparisons: {
  select: {
    winner: true,
    entry: {
      select: { title: true }
    }
  },
  take: 3,  // 只取前 3 条用于预览
}
```

更新 `QueryBatchesResult` 接口，在 batch 类型中增加：
```ts
comparisons: Array<{
  winner: string | null;
  entry: { title: string | null };
}>
```

#### 3.2.2 类型层：扩展 SerializedBatch

**改动文件**：`src/components/comparison/BatchHistoryList.tsx`

在 `SerializedBatch` 接口中增加：
```ts
comparisons?: Array<{
  winner: string | null;
  entry: { title: string | null };
}>;
winnerDistribution?: {
  source: number;
  target: number;
  tie: number;
};
```

`winnerDistribution` 由 `stats` 字段派生（若 `stats` 已包含），或在 API 层计算后注入。

#### 3.2.3 API 层：注入 winnerDistribution

**改动文件**：`src/app/api/comparison/batches/route.ts`

在序列化 batch 时，从 `comparisons` 计算 winner 分布并注入：
```ts
const winnerDistribution = {
  source: batch.comparisons.filter(c => c.winner === 'SOURCE').length,
  target: batch.comparisons.filter(c => c.winner === 'TARGET').length,
  tie: batch.comparisons.filter(c => c.winner === 'TIE' || c.winner === null).length,
};
```

> 注意：`comparisons` 只取了前 3 条（用于标题预览），winner 分布需要全量数据。需在 query 中额外聚合，或从 `stats` JSON 字段读取（若已存储）。**建议先检查 `stats` 字段结构**，若已包含分布数据则直接读取，避免额外查询。

#### 3.2.4 展示层：BatchCard 新增区块

**改动文件**：`src/components/comparison/BatchCard.tsx`

在现有 win rate / avg score diff 区块下方增加：

1. **条目标题预览**：展示前 2-3 个条目标题（截断至 40 字符），灰色小字。
2. **Winner 分布**：`Source X 胜 / Target Y 胜 / 平局 Z`，用色块区分。

UI 草图：
```
[sourceMode → targetMode]          [COMPLETED]
Entries: 20  Win Rate: 65%  Avg Diff: +1.2

条目预览：
  · How to use React hooks effectively
  · Understanding Transformer architecture
  · +17 more

Source 胜 13  |  Target 胜 5  |  平局 2
```

### 3.3 点击跳转验证

当前实现已正确，无需修改。可在实施后手动验证：点击 BatchCard → 跳转 `/comparison/[batchId]` → 详情页正常加载。

---

## 4. 涉及文件清单

| 文件 | 改动类型 | 说明 |
|------|----------|------|
| `src/components/comparison/BatchHistoryList.tsx` | Bug 修复 | `data.data.total` → `data.data.pageInfo.total` |
| `src/lib/comparison/query-batches.ts` | 功能扩展 | include comparisons（取前 3 条 + winner 字段） |
| `src/app/api/comparison/batches/route.ts` | 功能扩展 | 序列化时注入 `winnerDistribution` 和 `entryPreviews` |
| `src/components/comparison/BatchHistoryList.tsx` | 类型扩展 | 更新 `SerializedBatch` 接口 |
| `src/components/comparison/BatchCard.tsx` | UI 增强 | 新增条目预览和 winner 分布展示区块 |

---

## 5. 风险与注意事项

1. **stats 字段结构未知**：`stats: any` 可能已包含 winner 分布，实施前先 `console.log` 一条真实数据确认，避免重复计算。
2. **comparisons 数量**：标题预览只需前 3 条（`take: 3`），但 winner 分布需全量。若 `stats` 不含分布，需额外一次 `groupBy` 查询或在 `queryBatches` 中用 `_count` 聚合，注意性能影响。
3. **SSR 路径同步**：`comparison/page.tsx` 直接调用 `queryBatches`，需同步更新序列化逻辑，确保 `initialBatches` 也包含新字段。
4. **类型安全**：`comparisons` 为可选字段，`BatchCard` 需做 null 检查，避免 SSR hydration 报错。
5. **Load More 修复验证**：修复后需验证 `total` 在多次 Load More 后保持正确值，`hasMore` 逻辑正常。

---

## 实施计划

> Codex 评审反馈已全部落实：
> - winner 分布从 `ComparisonBatch.stats` 读取，不额外聚合
> - 条目预览用 `comparisons` 的 `createdAt ASC + take:3` 确定性排序
> - PENDING/PROCESSING 状态不显示 winner 分布和条目预览
> - 组件侧统一读取 `pageInfo.total`

### Step 1: 查询层增强（query-batches.ts）

**文件**：`src/lib/comparison/query-batches.ts`

**改动 1**：`QueryBatchesResult` 接口的 batch 类型增加 `entryPreviews` 字段（winner 分布直接从 `stats` 读取，不在查询层处理）：

```ts
export interface QueryBatchesResult {
  batches: Array<{
    id: string;
    createdAt: Date;
    sourceMode: string;
    targetMode: string;
    entryCount: number;
    status: string;
    progress: number;
    processedCount: number;
    winRate: number | null;
    avgScoreDiff: number | null;
    stats: any;
    entryPreviews: Array<{ title: string | null }>;  // 新增
  }>;
  total: number;
}
```

**改动 2**：`prisma.comparisonBatch.findMany` 的 `select` 增加 `comparisons` include，用 `createdAt ASC + take:3` 确定性排序：

```ts
// 在 select 块末尾，stats: true 之后增加：
comparisons: {
  select: {
    entry: {
      select: { title: true },
    },
  },
  orderBy: { createdAt: 'asc' },
  take: 3,
},
```

**改动 3**：`return` 前将 `comparisons` 映射为 `entryPreviews`，并从结果中剔除原始 `comparisons`：

```ts
return {
  batches: batches.map(({ comparisons, ...rest }) => ({
    ...rest,
    entryPreviews: comparisons.map((c) => c.entry),
  })),
  total,
};
```

---

### Step 2: API 响应格式（route.ts）

**文件**：`src/app/api/comparison/batches/route.ts`

**改动**：序列化 batch 时，从 `stats` 字段提取 winner 分布，并注入 `winnerDistribution` 和 `entryPreviews`。将现有的 `batches.map` 替换为：

```ts
batches: batches.map((batch) => {
  // Read winner distribution from stats (written at batch completion)
  const stats = batch.stats as Record<string, any> | null;
  const winnerDistribution = stats
    ? {
        source: stats.sourceWins ?? stats.source ?? 0,
        target: stats.targetWins ?? stats.target ?? 0,
        tie: stats.ties ?? stats.tie ?? 0,
      }
    : null;

  return {
    ...batch,
    createdAt: batch.createdAt.toISOString(),
    winnerDistribution,
    entryPreviews: batch.entryPreviews,
  };
}),
```

> `stats` 字段的 key 名称（`sourceWins` / `source` 等）需在首次运行时用真实数据确认，按实际 key 调整。

---

### Step 3: 组件类型适配（BatchHistoryList.tsx）

**文件**：`src/components/comparison/BatchHistoryList.tsx`

**改动 1**：`SerializedBatch` 接口增加新字段：

```ts
export interface SerializedBatch {
  id: string;
  createdAt: string;
  sourceMode: string;
  targetMode: string;
  entryCount: number;
  status: string;
  progress: number;
  processedCount: number;
  winRate: number | null;
  avgScoreDiff: number | null;
  stats: any;
  // 新增
  entryPreviews?: Array<{ title: string | null }>;
  winnerDistribution?: {
    source: number;
    target: number;
    tie: number;
  } | null;
}
```

**改动 2**：`loadMore` 中修复 `pageInfo.total` 读取（Bug 修复）。定位到 `setTotal(data.data.total)` 这一行，改为：

```ts
setTotal(data.data.pageInfo.total);
```

---

### Step 4: SSR 序列化同步（comparison/page.tsx）

**文件**：`src/app/comparison/page.tsx`

`queryBatches` 返回值已包含 `entryPreviews`，但 `serializedBatches` 的 spread 操作会自动携带新字段。唯一需要确认的是 `winnerDistribution` 由 API 层注入（SSR 路径直接调用 `queryBatches`，不经过 API route），因此需在 page.tsx 的序列化逻辑中同步注入：

```ts
const serializedBatches = result.batches.map((batch) => {
  const stats = batch.stats as Record<string, any> | null;
  const winnerDistribution = stats
    ? {
        source: stats.sourceWins ?? stats.source ?? 0,
        target: stats.targetWins ?? stats.target ?? 0,
        tie: stats.ties ?? stats.tie ?? 0,
      }
    : null;

  return {
    ...batch,
    createdAt: batch.createdAt.toISOString(),
    winnerDistribution,
    entryPreviews: batch.entryPreviews,
  };
});
```

> 为避免重复逻辑，可将序列化函数提取到 `src/lib/comparison/serialize-batch.ts`，供 route.ts 和 page.tsx 共用。这是可选优化，不影响功能正确性。

---

### Step 5: BatchCard UI 增强（BatchCard.tsx）

**文件**：`src/components/comparison/BatchCard.tsx`

**改动**：在现有 `renderWinRateIndicator` 区块之后，`return` 的 JSX 末尾（`</Link>` 关闭前）增加条件渲染区块。

仅 `status === 'COMPLETED'` 时显示 winner 分布和条目预览：

```tsx
{/* Entry previews + winner distribution — COMPLETED only */}
{isCompleted && (batch.entryPreviews?.length ?? 0) > 0 && (
  <div className="mt-3 pt-3 border-t border-border space-y-2">
    {/* Entry title previews */}
    <ul className="space-y-0.5">
      {batch.entryPreviews!.map((e, i) => (
        <li key={i} className="text-xs text-muted-foreground truncate">
          · {e.title ?? 'Untitled'}
        </li>
      ))}
      {batch.entryCount > 3 && (
        <li className="text-xs text-muted-foreground">
          · +{batch.entryCount - 3} more
        </li>
      )}
    </ul>

    {/* Winner distribution */}
    {batch.winnerDistribution && (
      <div className="flex gap-3 text-xs">
        <span className="text-green-600">
          Source {batch.winnerDistribution.source}胜
        </span>
        <span className="text-red-600">
          Target {batch.winnerDistribution.target}胜
        </span>
        <span className="text-gray-500">
          平局 {batch.winnerDistribution.tie}
        </span>
      </div>
    )}
  </div>
)}
```

PENDING / PROCESSING 状态：`isCompleted` 为 `false`，上述区块不渲染，只显示现有进度条（无需额外改动）。

---

### Step 6: 验证

1. **stats key 确认**：在 Step 2 实施前，临时在 route.ts 加 `console.log(JSON.stringify(batch.stats))` 打印一条 COMPLETED batch 的 stats，确认实际 key 名称后删除 log。

2. **Load More Bug 验证**：
   - 确保数据库有 >10 条 batch 记录
   - 打开 `/comparison`，点击 Load More
   - 验证 `total` 保持正确值，按钮在 `batches.length >= total` 时消失

3. **BatchCard 渲染验证**：
   - COMPLETED batch：显示条目预览 + winner 分布
   - PENDING / PROCESSING batch：只显示进度条，不显示预览区块

4. **类型检查**：
   ```bash
   docker compose exec app npm run type-check
   ```

5. **Lint**：
   ```bash
   docker compose exec app npm run lint
   ```
