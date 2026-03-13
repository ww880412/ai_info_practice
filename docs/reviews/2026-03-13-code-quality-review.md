# AI Practice Hub 代码质量评审报告

> 评审日期：2026-03-13 | 评审工具：everything-claude-code:code-reviewer

## 审查范围

- API Routes: ingest, entries, entries/[id], ai/process, upload, settings/credentials
- Core Libraries: ai/client.ts, ai/generate.ts, ai/agent/engine.ts, ai/agent/ingest-contract.ts, ai/providers/crs.ts
- Infrastructure: prisma.ts, crypto.ts, credential-validation.ts
- Frontend: LibraryPageClient.tsx
- Background Jobs: inngest/functions/process-entry.ts

## CRITICAL — 必须修复

### C1. Credential Validation SSRF 风险
**文件**: `src/lib/settings/credential-validation.ts:65-82`

`validateCrsCredential` 和 `validateOpenAICompatibleCredential` 直接拼接用户提供的 `baseUrl` 发起 HTTP 请求，无 SSRF 校验。

**修复**: 在验证前执行 SSRF 检查。

### C2. Gemini API Key 泄露在 URL 中
**文件**: `src/lib/settings/credential-validation.ts:53`

API Key 作为 query parameter 会出现在各种日志中。应改用 Header：
```typescript
headers: { 'x-goog-api-key': apiKey }
```

### C3. processWithMode 非线程安全
**文件**: `src/lib/ai/agent/engine.ts:309-338`

临时修改 `this.config` 实现模式切换，并发调用时会互相覆盖。应将 config 作为参数传递。

### C4. 全局可变状态导致凭证泄漏风险
**文件**: `src/lib/ai/client.ts:224-232`

模块级 `serverConfig` 全局变量在 Inngest worker 并发处理时存在竞态条件。

**修复**: 使用 AsyncLocalStorage 或参数显式传递。

## HIGH — 应该修复

### H1. 大量代码重复: process-entry.ts vs ai/process/route.ts
以下函数完全重复：
- `buildDecisionFromClassifier()` (~30 行)
- `normalizePracticeTaskFromLegacyResult()` (~30 行)
- `shouldAllowLegacyClassifierFallback()` (1 行)
- `updateProcessStatus()` / `updateEntryProcessStatus()`
- 保存 decision 到数据库的逻辑 (~60 行)

**修复**: 提取到 `src/lib/ai/processing-pipeline.ts`。

### H2. PATCH /api/entries/[id] 缺少输入验证
**文件**: `src/app/api/entries/[id]/route.ts:51`

`body` 未经 schema 验证，应使用 Zod 校验。

### H3. SSRF 防护不完整
**文件**: `src/app/api/ingest/route.ts:57-68`

遗漏 IPv6 本地地址、`0.0.0.0`、DNS Rebinding、URL 编码绕过。

### H4. console.log/warn/error 散布生产代码
30+ 文件中大量 console 调用。建议引入结构化日志库。

### H5. 加密 salt 硬编码
**文件**: `src/lib/crypto.ts:17`
Salt 固定为 `'api-credential-salt'`。建议配置为环境变量。

## MEDIUM — 建议修复

### M1. LibraryPageClient.tsx 过大 (756 行)
16 个 useState，职责过多。建议拆分 hooks 和子组件。

### M2. engine.ts 过大 (910 行)
建议提取 prompt 构建逻辑和工具函数。

### M3. toObject 函数重复定义
`engine.ts` 和 `ingest-contract.ts` 中各有一份。应统一。

### M4. EntryCardEntry 类型定义位置不当
定义在文件最底部，应移到 `src/types/`。

### M5. GET /api/entries 的 orderBy 使用 any 类型
应使用 `Prisma.EntryOrderByWithRelationInput`。

### M6. PATCH 路由的 catch-then 反模式
应使用 Prisma `upsert` 方法。

### M7. 缺少 API 认证中间件

### M8. localStorage 在服务端代码中的使用
`client.ts` 中混合运行时检查增加不必要的复杂性。

## 总体评价

| 维度 | 评分 | 说明 |
|------|------|------|
| 安全性 | 中等 | SSRF 基本到位但有漏洞；credential 管理注意了不返回密文 |
| 错误处理 | 良好 | 大部分 API 有 try-catch，Inngest 有 onFailure 和重试 |
| 类型安全 | 中等 | 大量 `Record<string, unknown>` 和类型断言 |
| 代码复用 | 需改进 | process-entry.ts 和 ai/process/route.ts 大量重复 |
| 性能 | 良好 | 合理使用 Promise.all、流式上传、provider 缓存 |
| 可维护性 | 中等 | 大文件偏多，但整体目录结构清晰 |
