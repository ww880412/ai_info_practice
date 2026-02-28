# Codex 评审 - 延后修复项

**日期**: 2026-02-28
**评审范围**: Phase 1 (Vercel AI SDK) + Phase 2 (Inngest)

## 延后修复

### 1. `buildSemanticSnapshot` 忽略 limit 参数

**级别**: Medium
**位置**: `src/lib/ai/agent/engine.ts:171,181`
**问题**: 长文本分支（>50k）硬编码 head=8k + tail=4k，忽略传入的 `limit` 参数。Step 2 预算 90k 但实际只取 ~12k。
**建议**: 按 `limit` 动态分配 head/tail 比例。

```typescript
// 当前实现
if (content.length > MEDIUM_THRESHOLD) {
  const headSize = 8_000;  // 硬编码
  const tailSize = 4_000;  // 硬编码
  ...
}

// 建议改为
if (content.length > MEDIUM_THRESHOLD) {
  const headSize = Math.floor(limit * 0.65);
  const tailSize = Math.floor(limit * 0.35);
  ...
}
```

---

### 2. Inngest 幂等与版本写入竞争

**级别**: Medium
**位置**: `src/lib/inngest/functions/process-entry.ts:370`
**问题**: `findLatest + create(version+1)` 非原子操作，重复触发时可能产生版本冲突。
**建议**:
- 发送事件时添加 deterministic `id`（如 `entryId-timestamp`）
- 添加 `concurrency` 约束限制同一 entryId 并发
- 或改用原子版本策略（upsert with increment）

```typescript
// 建议添加并发约束
export const processEntry = inngest.createFunction(
  {
    id: 'process-entry',
    concurrency: {
      key: 'event.data.entryId',
      limit: 1,
    },
    ...
  },
  ...
);
```

---

### 3. 文件解析缺少 schema 约束

**级别**: Medium
**位置**: `src/lib/parser/pdf.ts:239`, `src/lib/ai/generate.ts:52`
**问题**: `generateFromFile` 返回结构未经 Zod 校验，模型输出漂移时易出现空字段或运行时异常。
**建议**: 对文件提取结果使用 `generateObject + zod schema`，并对 `content` 做非空校验。

```typescript
// 建议
const FileExtractSchema = z.object({
  title: z.string(),
  content: z.string().min(1),
});

const result = await generateFromFile(prompt, fileData, FileExtractSchema);
```

---

## 已修复项

| 问题 | 级别 | 修复提交 |
|------|------|----------|
| 全局 serverConfig 并发污染 | Critical | 23b7934 |
| API Key 放入事件数据 | Critical | 23b7934 |
| normalizeStep2Payload 丢字段 | High | 23b7934 |
| TEXT 分支未持久化 | High | 23b7934 |
| LINK SSRF 校验 | Medium | 23b7934 |

---

## 跟进计划

- [ ] Phase 4 清理时处理 #1 (limit 参数)
- [ ] 生产部署前处理 #2 (并发约束)
- [ ] 下一迭代处理 #3 (schema 约束)
