# Library 批量删除实现与故障修复（2026-02-22）

## 背景

知识库页面新增“多选 + 批量删除”后，前端出现 `Failed to batch delete entries`。

## 根因

后端批量删除接口最初直接执行：

- `prisma.entry.deleteMany({ where: { id: { in: ids }}})`

但数据库中 `ParseLog.entryId -> Entry.id` 外键在实际环境里未配置 `ON DELETE CASCADE`，导致 Prisma 抛出 `P2003`：

- `Foreign key constraint violated: ParseLog_entryId_fkey`

## 代码修复

1. 新增删除服务：

- `src/lib/entries/delete.ts`
  - `deleteEntriesWithDependencies(ids)`：事务内先删 `ParseLog`，再删 `Entry`
  - `deleteEntryWithDependencies(id)`：单条删除同样走依赖清理

2. 接口接入：

- `src/app/api/entries/route.ts` 的批量 `DELETE` 改为调用 `deleteEntriesWithDependencies`
- `src/app/api/entries/[id]/route.ts` 的单条 `DELETE` 改为调用 `deleteEntryWithDependencies`

3. 参数校验：

- `src/lib/entries/bulk-delete.ts`：批量删除入参解析（去重、过滤空值、类型校验）

## 运行时修复（数据库）

对线上/本地历史库建议执行一次外键修正，避免依赖应用层兜底：

```sql
ALTER TABLE "ParseLog" DROP CONSTRAINT IF EXISTS "ParseLog_entryId_fkey";
ALTER TABLE "ParseLog"
  ADD CONSTRAINT "ParseLog_entryId_fkey"
  FOREIGN KEY ("entryId") REFERENCES "Entry"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
```

## 验证

- `npm run lint` 通过
- `npm run test:run`（含 `src/lib/entries/bulk-delete.test.ts`）通过
- `npm run build` 通过
- 接口 smoke：创建 `Entry + ParseLog` 后调用 `DELETE /api/entries` 返回 `200` 且数据被清理

