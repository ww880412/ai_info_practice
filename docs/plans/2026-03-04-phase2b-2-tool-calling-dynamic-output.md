# Phase 2b-2: Tool-Calling 模式动态输出深度 实施计划

**版本**: v1.2
**日期**: 2026-03-04
**状态**: ⏩ 进入 Layer 2 实施阶段
**前置**: Phase 2b-1 已完成并验证
**Codex 第 1 轮评审**: REVISE（5 个问题）
**Codex 第 2 轮评审**: 部分通过（2 个 P1 新问题已修复）
**Codex 第 3 轮评审**: 2 个 P1 细节问题待实施时处理

---

## 一、目标

让 tool-calling 模式（`executeWithTools`）也能根据内容长度动态输出 `summaryStructure.fields`，与两步模式行为一致。

---

## 二、问题分析

### 2.1 两步模式（Phase 2b-1 已解决）

| 组件 | 位置 | 解决方案 |
|------|------|---------|
| `buildStep2Prompt()` | engine.ts | 注入 `fieldsGuidance` |
| 结果合并 | `mergeTwoStepResults` | Step 2 覆盖 Step 1 |

### 2.2 tool-calling 模式（待解决）

| 组件 | 位置 | 当前问题 |
|------|------|---------|
| `extract_summary` prompt | sdk-tools.ts:186-223 | 缺少 `fieldsGuidance` |
| 结果合并 | engine.ts:426-436 | `ctx.shared.intermediateResults.summary` 不含 fields |

---

## 三、技术方案

### 3.1 改动范围

| 改动类型 | 文件 | 内容 |
|----------|------|------|
| **修改** | sdk-tools.ts | `extract_summary` prompt 注入 fieldsGuidance + 扩展输出契约 |
| **修改** | engine.ts | 调整合并逻辑，保留 Step2 的 fields |
| **新增** | - | 添加 prompt guardrails |

### 3.2 具体修改

**sdk-tools.ts**，三处修改：

1. **导入 content-depth 函数**（文件顶部）：
```typescript
import { getContentDepth, getFieldsGuidance } from './content-depth';
```

2. **注入 fieldsGuidance**（extract_summary prompt 第 186 行附近）：
```typescript
// 先计算内容深度
const depth = getContentDepth(content.length);
const structureType = classification?.summaryStructure?.type;
const fieldsGuidance = getFieldsGuidance(depth, structureType);

// 在 prompt 中添加
`内容深度分级：${depth}
${fieldsGuidance}

Step 1 结果：
${step1Json}
...`
```

3. **扩展输出契约**（prompt 输出要求部分）：
```json
{
  "coreSummary": "string",
  "summaryStructure": {
    "type": "string",
    "fields": { "key": "value" },
    "reasoning": "string"
  },
  ...
}
```

### 3.3 engine.ts 合并逻辑调整

**engine.ts 第 426-436 行**，调整合并顺序：

```typescript
// 完整合并逻辑（保留原有 extractedMetadata）
const finalResult = {
  ...(ctx.shared.classification || {}),
  ...(ctx.shared.intermediateResults.summary || {}),
  ...(result.output || {}),

  // ⚠️ 确保 summaryStructure 来自 Step2，fallback 到 Step1
  summaryStructure: ctx.shared.intermediateResults.summary?.summaryStructure
    ?? result.output?.summaryStructure
    ?? ctx.shared.classification?.summaryStructure  // ← fallback 到 Step1
    ?? { type: 'generic', fields: {} },

  // ⚠️ 保留原有的 extractedMetadata 组装（engine.ts:431）
  extractedMetadata: {
    codeExamples: ctx.shared.intermediateResults.codeExamples,
    versionInfo: ctx.shared.intermediateResults.versionInfo,
    references: ctx.shared.intermediateResults.references,
  },
};
```

**TypeScript 类型安全修复**（sdk-tools.ts 第 58 行附近）：

```typescript
// 添加类型守卫
const structureType = (classification?.summaryStructure as { type?: string })?.type;
```

### 3.4 复用 Phase 2b-1 成果

导入 `content-depth.ts` 中的：
- `getContentDepth(contentLength)` - 判断内容深度
- `getFieldsGuidance(depth, type)` - 生成字段指导

---

## 四、验收标准

| ID | 标准 | 验证方式 |
|----|------|----------|
| AC1 | tool-calling 模式输出非空 fields | 手动测试 |
| AC2 | fields 内容与两步模式一致 | 对比测试 |
| AC3 | npm run test 通过 | 自动化 |
| AC4 | npx tsc --noEmit 通过 | 自动化 |
| AC5 | 手动验收：SHORT/MEDIUM/LONG 各 1 条 | 手动 |

---

## 五、Codex 第 1 轮评审问题修复

| 问题 | 严重度 | 修复方案 |
|------|--------|----------|
| API 调用不匹配 | P0 | 使用 `getContentDepth()` + `getFieldsGuidance(depth, type)` |
| 仅 guidance 不足 | P0 | 扩展 extract_summary 输出契约含 summaryStructure |
| 合并顺序风险 | P1 | 调整 engine.ts 合并逻辑，保留 Step2 fields |
| Prompt 注入风险 | P1 | 添加 JSON.stringify 消毒处理 |
| 验证命令缺失 | P2 | 改用 `npx tsc --noEmit` |

## 六、Codex 第 2 轮评审问题修复

| 问题 | 严重度 | 修复方案 |
|------|--------|----------|
| Merge fallback 回归 | P1 | fallback 顺序：Step2 → Step1 → 默认值 |
| TS 类型安全 | P1 | 添加类型守卫 `as { type?: string }` |
| 一致性缺口 | P2 | 文档说明只保证 summaryStructure |

## 六点五、Codex 第 3 轮评审遗留问题（实施时处理）

> 根据内部系统安全原则，记录遗留问题，实施时确保修复

| 问题 | 严重度 | 状态 | 实施备注 |
|------|--------|------|----------|
| Merge fallback 优先级 | P1 | 待修复 | 确保 Step2 有内容时优先使用，否则 fallback 到 Step1 |
| extractedMetadata 回归 | P1 | ⚠️ 注意 | 实施时必须保留 engine.ts:431 的 extractedMetadata 组装逻辑 |
| 自动化测试覆盖 | P2 | 待补充 | 后续可补充 tool-calling merge 顺序的单元测试 |

### 实施检查清单

- [ ] 确认 `extractedMetadata` 组装逻辑未被删除
- [ ] 确认 `summaryStructure` fallback 顺序正确
- [ ] 验证 `codeExamples/versionInfo/references` 不丢失

---

## 六、风险评估

| 风险 | 概率 | 影响 | 缓解 |
|------|------|------|------|
| LLM 不遵循 fieldsGuidance | 中 | 中 | Phase 2c few-shot 示例 |
| SDK prompt 格式冲突 | 低 | 中 | 测试验证 |
| 合并逻辑回归 | 低 | 高 | 对比测试确保 Step2 覆盖 |

---

## 七、工作量估算

| 任务 | 估时 |
|------|------|
| sdk-tools.ts 修改（prompt + 输出契约 + 类型守卫） | 25min |
| engine.ts 合并逻辑调整 | 15min |
| 导入 content-depth | 5min |
| TypeScript 编译验证 | 10min |
| 手动验收（SHORT/MEDIUM/LONG） | 30min |
| **合计** | **1.5h** |

---

## 八、测试策略

| 测试类型 | 内容 |
|----------|------|
| 编译验证 | `npx tsc --noEmit` |
| 单元测试 | `npm run test` |
| 手动测试 | 提交 3 条内容（SHORT/MEDIUM/LONG），验证 fields |
| 对比测试 | 对比两步模式和 tool-calling 模式的 fields 输出 |

---

*文档版本: v1.2 | Codex 第 2 轮评审发现 2 个 P1 问题已修复，待第 3 轮评审*
