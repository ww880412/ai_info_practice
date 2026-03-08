# Scoring Agent 第二轮 Codex 评审结果

> 评审时间：2026-03-06
> 评审工具：Codex (gpt-5.4, xhigh reasoning)
> Token 消耗：123,434

## 评审结果

**总体评分**: 7/10

**修复质量**:
- P0 修复: ✅
- P1 修复: ❌
- 新增问题: 0 个

---

## 剩余问题

### P1（建议修复）

**Prompt 注入防护不完整**

上一轮的"prompt 安全/覆盖"问题没有完全修复。

- **问题位置**: `src/lib/ai/agent/scoring-agent.ts:67` 和 `:72`
- **问题描述**:
  - 只对标题做了 `JSON.stringify()`
  - 正文仍在第 72 行直接拼进 prompt：
    ```typescript
    **内容摘要**（前 3000 字符）:
    ${originalContent.content.slice(0, 3000)}  // ❌ 未转义
    ```
  - 原文里的指令仍然可以干扰评分
  - 当前只取前 3000 字，长文后半段的步骤、代码和结论会被直接忽略

- **修复建议**:
  ```typescript
  **内容摘要**（前 3000 字符）:
  ${JSON.stringify(originalContent.content.slice(0, 3000))}  // ✅ 添加转义
  ```

### P2（可选优化）

1. **单元测试覆盖不足**
   - 位置: `src/lib/ai/agent/__tests__/scoring-agent.test.ts:71`
   - 问题: 只验证返回值，没有覆盖：
     - Prompt 内容构造
     - `generateJSON` 的 schema 传参
     - `evaluate_quality` 工具层
     - 异常路径
   - 影响: 残留的 prompt 问题不会被测试兜住

2. **集成测试脚本不可靠**
   - 位置: `scripts/test-scoring-agent.ts:281`
   - 问题:
     - Live smoke script，没有 env preflight
     - 没有接入 `package.json` scripts
     - 不是确定性的回归保护

---

## 修复验证

### 1. TypeScript 编译
- **状态**: ✅
- **说明**: `npx tsc --noEmit` 本地通过，上一轮 P0 已消失

### 2. 契约字段对齐
- **状态**: ✅
- **说明**:
  - 评分 prompt 已改为使用 `keyPointsNew`
  - 见 `scoring-agent.ts:89` 和 `:144`
  - 测试 fixture 也已改成 `keyPoints: string[] + keyPointsNew` 真实结构
  - 见 `scoring-agent.test.ts:78` 和 `test-scoring-agent.ts:15`

### 3. 工具接口模式
- **状态**: ✅
- **说明**:
  - `evaluate_quality` 不再要求模型重传原文
  - 从 `ctx.input` 读取标题和正文
  - 见 `sdk-tools.ts:417` 和 `:418`

### 4. Prompt 注入防护
- **状态**: ❌
- **说明**: 只修了标题，正文未修；同时长文覆盖仍是简单截断

### 5. 定向测试
- **状态**: ✅
- **说明**: `npx vitest run src/lib/ai/agent/__tests__/scoring-agent.test.ts` 5/5 通过

---

## 建议

**当前不建议合并**。

- ✅ P0 已修复
- ✅ P1 里的"错误字段引用"和"工具接口重传原文"也已修复
- ❌ 但"prompt 安全/覆盖"这一项只修了一半

**下一步**:
1. 把正文改成安全序列化后的内容快照
2. 补一条断言 prompt 构造的单测
3. 再做一轮快速复审即可

---

## 详细分析

### P0 修复情况（已完成）

第一轮评审的 P0 问题已全部修复：

1. ✅ TypeScript 编译错误 - `z.record(z.unknown())` 语法问题
2. ✅ `keyPoints` 字段结构不匹配
3. ✅ 无效的 `techDomain: 'LLM'` 枚举值
4. ✅ 缺少 `confidence` 字段

### P1 修复情况（部分完成）

第一轮评审的 3 个 P1 问题：

1. ✅ 评分 prompt 针对错误字段 `keyPoints.core` → 已改为 `keyPointsNew.core`
2. ✅ `evaluate_quality` 工具接口要求重传原文 → 已改为从 `ctx.input` 读取
3. ❌ Prompt 缺少安全防护 → **只修了一半**（标题已转义，正文未转义）

### 新增问题

无新增问题。

---

## 总结

本次修复解决了所有 P0 阻塞性问题和大部分 P1 问题，代码已经可以编译和运行。但由于 prompt 注入防护不完整，存在安全风险，建议完成剩余的 P1 修复后再合并。

修复工作量预估：5-10 分钟（修改 1 行代码 + 添加 1 个测试用例）。
