# Scoring Agent Codex 评审结果

> 评审时间：2026-03-06
> 评审工具：Codex (gpt-5.4, xhigh reasoning)
> Token 消耗：77,924

## 评审结果

**总体评分**: 4/10

按当前仓库里的 [`NormalizedAgentIngestDecision`](/Users/ww/Desktop/mycode/ai_info_practice/src/lib/ai/agent/ingest-contract.ts#L54) 和 [`TechDomain`](/Users/ww/Desktop/mycode/ai_info_practice/prisma/schema.prisma#L218) 作为单一真理评审。

**问题分级**:
- P0（必须修复）: 1 个
- P1（建议修复）: 3 个
- P2（可选优化）: 2 个

## P0 问题

### 1. 当前实现不能通过仓库级 TypeScript 检查，尚不可合并

**位置**:
- [`sdk-tools.ts:405`](/Users/ww/Desktop/mycode/ai_info_practice/src/lib/ai/agent/sdk-tools.ts#L405)
- [`sdk-tools.ts:408`](/Users/ww/Desktop/mycode/ai_info_practice/src/lib/ai/agent/sdk-tools.ts#L408)
- [`scoring-agent.test.ts:73`](/Users/ww/Desktop/mycode/ai_info_practice/src/lib/ai/agent/__tests__/scoring-agent.test.ts#L73)
- [`scripts/test-scoring-agent.ts:10`](/Users/ww/Desktop/mycode/ai_info_practice/scripts/test-scoring-agent.ts#L10)

**原因**:
`npx tsc --noEmit` 直接失败。`z.record(z.unknown())` 在当前 Zod 版本下类型不成立；测试和脚本又把 `NormalizedAgentIngestDecision` 当成 `{ keyPoints: { core, extended } }` 来用，并写入当前 Prisma 枚举里不存在的 `techDomain: 'LLM'`。这不是单测小问题，而是实现与仓库真实契约已经脱节。

**建议**:
先把工具输入 schema 改成可编译且可校验的真实结构，优先用 `normalizeAgentIngestDecision` 或专用 Zod schema 做收口；如果 `LLM/DEEP_LEARNING` 是正式需求，必须同步 Prisma schema、类型和所有调用方，否则测试与脚本都要回到当前合法枚举。

## P1 问题

### 1. 评分 prompt 针对的是错误字段，实际运行时会对不存在的 `keyPoints.core` 打分

**位置**:
- [`scoring-agent.ts:88`](/Users/ww/Desktop/mycode/ai_info_practice/src/lib/ai/agent/scoring-agent.ts#L88)
- [`scoring-agent.ts:104`](/Users/ww/Desktop/mycode/ai_info_practice/src/lib/ai/agent/scoring-agent.ts#L104)
- [`scoring-agent.ts:144`](/Users/ww/Desktop/mycode/ai_info_practice/src/lib/ai/agent/scoring-agent.ts#L144)
- [`ingest-contract.ts:59`](/Users/ww/Desktop/mycode/ai_info_practice/src/lib/ai/agent/ingest-contract.ts#L59)
- [`ingest-contract.ts:61`](/Users/ww/Desktop/mycode/ai_info_practice/src/lib/ai/agent/ingest-contract.ts#L61)

**原因**:
归一化后的真实结构是 `keyPoints: string[]` 加 `keyPointsNew: { core, extended }`，但评分 rubric、示例 issue/suggestion 都在引导模型检查 `keyPoints.core`。即使编译修好，评分也会围绕错字段给出结论。

**建议**:
统一到真实运行态字段，优先让评分器显式消费 `keyPointsNew.core/extended`，或者在进入评分器前先构造一个专门的 view model。

### 2. `evaluate_quality` 的工具接口违背现有 `sdk-tools` 模式，让模型重复传整段原文

**位置**:
- [`sdk-tools.ts:20`](/Users/ww/Desktop/mycode/ai_info_practice/src/lib/ai/agent/sdk-tools.ts#L20)
- [`sdk-tools.ts:61`](/Users/ww/Desktop/mycode/ai_info_practice/src/lib/ai/agent/sdk-tools.ts#L61)
- [`sdk-tools.ts:407`](/Users/ww/Desktop/mycode/ai_info_practice/src/lib/ai/agent/sdk-tools.ts#L407)

**原因**:
现有工具都从 `ctx.input` 读取上下文；这里只有评分工具要求模型把 `originalTitle` 和 `originalContent` 作为参数重新回传。对长文章，这会把 tool call 变成一次大文本复制，既浪费 token，也更容易撞到调用长度限制。

**建议**:
工具入参只保留 `decision` 和少量选项，原文标题/内容直接从 `ctx.input` 读取。

### 3. prompt 的安全性和有效样本覆盖都偏弱

**位置**:
- [`scoring-agent.ts:67`](/Users/ww/Desktop/mycode/ai_info_practice/src/lib/ai/agent/scoring-agent.ts#L67)
- [`scoring-agent.ts:71`](/Users/ww/Desktop/mycode/ai_info_practice/src/lib/ai/agent/scoring-agent.ts#L71)
- [`scoring-agent.ts:78`](/Users/ww/Desktop/mycode/ai_info_practice/src/lib/ai/agent/scoring-agent.ts#L78)

**原因**:
这里直接插入用户标题、正文和决策 JSON，只截前 3000 字。仓库别处已经明确做过 `JSON.stringify` 防 prompt 注入，并为长文实现了 semantic snapshot。评分器现在既容易被原文里的指令污染，也很容易漏掉后半段的步骤、结论和代码，从而把"准确性/可操作性"评错。

**建议**:
复用现有 snapshot 策略，至少采用 head/middle/tail 或 semantic snapshot；所有用户可控文本先做安全序列化再拼 prompt。

## P2 问题

### 1. 单元测试覆盖太浅

**位置**:
- [`scoring-agent.test.ts:12`](/Users/ww/Desktop/mycode/ai_info_practice/src/lib/ai/agent/__tests__/scoring-agent.test.ts#L12)
- [`scoring-agent.test.ts:71`](/Users/ww/Desktop/mycode/ai_info_practice/src/lib/ai/agent/__tests__/scoring-agent.test.ts#L71)

**原因**:
它没有断言 prompt 内容、没有断言 `generateJSON` 收到 `QualityEvaluationSchema`、没有覆盖异常路径、也没有覆盖 `sdk-tools` 注册层，所以才会出现 "`vitest` 全绿但 `tsc` 爆红" 的假阳性。

**建议**:
加上 prompt 断言、错误传播测试、`evaluate_quality` 工具测试，并使用与仓库真实契约一致的 fixture。

### 2. 集成测试脚本更像手工 smoke script

**位置**:
- [`test-scoring-agent.ts:270`](/Users/ww/Desktop/mycode/ai_info_practice/scripts/test-scoring-agent.ts#L270)
- [`package.json:5`](/Users/ww/Desktop/mycode/ai_info_practice/package.json#L5)

**原因**:
脚本直接调用真实模型，没有 env preflight，没有 deterministic assertion，也没有 npm script 接入。当前环境下 `timeout 5s npx tsx --tsconfig tsconfig.json scripts/test-scoring-agent.ts` 无输出超时，不能作为可靠回归保护。

**建议**:
明确标注为手工脚本并增加环境检查；如果想要自动化保护，改成 mock/stub 驱动的集成测试并接入 `package.json`。

## 优点

1. [`scoring-agent.ts:6`](/Users/ww/Desktop/mycode/ai_info_practice/src/lib/ai/agent/scoring-agent.ts#L6) 用 Zod 定义了清晰的输出契约，5 个维度和 `actionability: null` 的设计方向是对的。
2. [`scoring-agent.ts:46`](/Users/ww/Desktop/mycode/ai_info_practice/src/lib/ai/agent/scoring-agent.ts#L46) 通过 `generateJSON + schema` 调模型，符合仓库现有 AI 调用模式。
3. [`sdk-tools.ts:425`](/Users/ww/Desktop/mycode/ai_info_practice/src/lib/ai/agent/sdk-tools.ts#L425) 返回 `success/data/message` 包装，与同文件其他工具的返回风格一致。
4. [`scoring-agent.test.ts:6`](/Users/ww/Desktop/mycode/ai_info_practice/src/lib/ai/agent/__tests__/scoring-agent.test.ts#L6) 在单测里 mock 掉模型边界，这个方向比直接打 live LLM 更合理。

## 总结

这版实现我不建议通过。核心不是"还差一点测试"，而是它当前同时存在构建阻断、契约漂移和运行时评分对象不对齐三个层面的硬问题。优先级应是先修复 `tsc` 红线，再统一 `NormalizedAgentIngestDecision` 的真实输入形态，最后再补 prompt 安全和测试覆盖。

**验证结果**:
- ✅ `npx vitest run src/lib/ai/agent/__tests__/scoring-agent.test.ts` 通过
- ❌ `npx tsc --noEmit` 失败（8 个类型错误）

这说明当前测试不能证明实现已可交付。

## 下一步行动

### 立即修复（P0）
1. 修复 `z.record(z.unknown())` → `z.record(z.string(), z.unknown())`
2. 统一 `keyPoints` 字段使用（使用 `keyPointsNew` 或创建 view model）
3. 移除测试中的 `techDomain: 'LLM'`，使用合法枚举值

### 近期修复（P1）
1. 修改 `evaluate_quality` 工具，从 `ctx.input` 读取原文
2. 实现 prompt 注入防护（JSON.stringify）
3. 使用 semantic snapshot 替代简单截断

### 后续优化（P2）
1. 增强单元测试覆盖
2. 改进集成测试脚本
