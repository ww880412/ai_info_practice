# Codex 评审 - 延后修复项

**日期**: 2026-02-28
**评审范围**: Phase 0 (R2 存储) + Phase 1 (Vercel AI SDK) + Phase 2 (Inngest)

## 延后修复

### 1. 上传文件类型校验

**级别**: Medium
**来源**: Phase 0 Codex 评审
**位置**: `src/app/api/upload/route.ts`
**问题**: 未校验上传文件的 MIME 类型和文件扩展名，可能允许危险文件类型。
**说明**: 非本次迁移引入的问题，现有代码已存在。
**建议**: 添加白名单校验允许的文件类型 (pdf, png, jpg, jpeg, webp)。

---

### 2. localStorage 存储 API Key

**级别**: Medium
**来源**: Phase 0 Codex 评审
**位置**: `src/hooks/useIngest.ts`, 前端配置组件
**问题**: API Key 存储在 localStorage，存在 XSS 泄露风险。
**说明**: 现有设计问题，用户自带 API Key 场景。
**建议**:
- 短期: 提示用户风险
- 长期: 改用 httpOnly cookie 或后端存储 + 引用 ID

---

### 3. 大文件内存/超时

**级别**: Medium
**来源**: Phase 0 Codex 评审
**位置**: `src/lib/storage/upload.ts`, `src/lib/parser/pdf.ts`
**问题**: 大文件上传和解析时可能导致内存溢出或请求超时。
**说明**: 需要更大的架构改动（流式处理、分片上传）。
**建议**:
- 添加文件大小限制提示 (如 10MB)
- 考虑流式上传到 R2
- 考虑分页解析大 PDF

---

### 4. `buildSemanticSnapshot` 忽略 limit 参数

**级别**: Medium
**来源**: Phase 1/2 Codex 评审
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

### 5. Inngest 幂等与版本写入竞争

**级别**: Medium
**来源**: Phase 1/2 Codex 评审
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

### 6. 文件解析缺少 schema 约束

**级别**: Medium
**来源**: Phase 1/2 Codex 评审
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

### 7. URL 发送给第三方 Jina（敏感参数风险）

**级别**: Medium (已缓解)
**来源**: Phase 3 Codex 评审
**位置**: `src/lib/parser/jina.ts:24`
**问题**: 所有网页 URL 会发送给第三方 Jina，可能含 token/query 敏感参数。
**已处理**: 添加 `PARSER_JINA_ENABLED` 开关，可禁用 Jina。
**待处理**: 敏感参数脱敏、特定域名禁用 Jina。

---

### 8. Jina 串行超时预算

**级别**: Low
**来源**: Phase 3 Codex 评审
**位置**: `src/lib/parser/jina.ts:6`, `src/lib/parser/webpage.ts:87`
**问题**: 最坏情况 Jina(15s) + Cheerio(15s) = 30s/URL。
**已处理**: 将 Jina 超时从 30s 降到 15s。
**待处理**: 429/5xx 快速降级、熔断机制。

---

## 已修复项

| 问题 | 级别 | 修复提交 |
|------|------|----------|
| 全局 serverConfig 并发污染 | Critical | 23b7934 |
| API Key 放入事件数据 | Critical | 23b7934 |
| normalizeStep2Payload 丢字段 | High | 23b7934 |
| TEXT 分支未持久化 | High | 23b7934 |
| LINK SSRF 校验 | Medium | 23b7934 |
| Jina metadata 丢失 | High | (Phase 3) |
| 错误 API header x-respond-with | Medium | (Phase 3) |
| isTwitterUrl 误判 | Low | (Phase 3) |
| 错误链合并 | Medium | (Phase 3) |

---

## 跟进计划

- [ ] #1 上传文件类型校验 - 下一迭代
- [ ] #2 localStorage 存 API Key - 长期改进
- [ ] #3 大文件内存/超时 - 架构改进
- [ ] #4 buildSemanticSnapshot limit - Phase 4 清理
- [ ] #5 Inngest 幂等竞争 - 生产部署前
- [ ] #6 文件解析 schema 约束 - 下一迭代
- [ ] #7 Jina 敏感参数脱敏 - 下一迭代
- [ ] #8 Jina 熔断机制 - 性能优化
