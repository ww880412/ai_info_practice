# Scoring Agent 实施评审

## 评审目标

评审刚完成的 AI 处理结果评分 Agent 实施，验证：
1. 代码实现是否符合设计方案
2. 是否存在潜在的架构问题
3. 是否有遗漏的关键功能
4. 代码质量和测试覆盖

## 实施内容

### 新增文件
1. `src/lib/ai/agent/scoring-agent.ts` - 评分 Agent 核心逻辑
2. `src/lib/ai/agent/__tests__/scoring-agent.test.ts` - 单元测试
3. `scripts/test-scoring-agent.ts` - 集成测试脚本

### 修改文件
1. `src/lib/ai/agent/sdk-tools.ts` - 注册 evaluate_quality 工具

## 设计方案

参考文档：用户提供的设计方案（在会话上下文中）

核心要点：
- 5 个评分维度：完整性、准确性、相关性、清晰度、可操作性
- 独立工具实现，可被 AI 主动调用
- 支持 KNOWLEDGE 和 ACTIONABLE 两种内容类型
- 输出包含分数、问题列表、建议和评分理由

## 评审要求

请按照以下维度评审：

### 1. 架构一致性
- 是否符合现有 Agent 架构模式
- 是否与 sdk-tools.ts 的工具注册模式一致
- 是否正确使用了 generateJSON 函数

### 2. 接口契约
- QualityEvaluationSchema 是否完整
- ScoringInput 接口是否合理
- evaluate_quality 工具的输入输出是否符合 Vercel AI SDK 规范

### 3. 实现质量
- buildScoringPrompt 函数的 prompt 设计是否合理
- 是否正确处理了 KNOWLEDGE vs ACTIONABLE 的差异
- 错误处理是否充分

### 4. 测试覆盖
- 单元测试是否覆盖了关键场景
- 是否使用了正确的 mock 策略
- 集成测试脚本是否可执行

### 5. 潜在问题
- 是否存在性能问题（如 prompt 过长）
- 是否存在安全问题（如 prompt 注入）
- 是否存在与现有代码的冲突

## 评审输出格式

请按照以下格式输出评审结果：

```
## 评审结果

**总体评分**: X/10

**问题分级**:
- P0（必须修复）: X 个
- P1（建议修复）: X 个
- P2（可选优化）: X 个

### P0 问题

1. [问题描述]
   - 位置: [文件:行号]
   - 原因: [为什么是 P0]
   - 建议: [如何修复]

### P1 问题

1. [问题描述]
   - 位置: [文件:行号]
   - 原因: [为什么是 P1]
   - 建议: [如何修复]

### P2 问题

1. [问题描述]
   - 位置: [文件:行号]
   - 原因: [为什么是 P2]
   - 建议: [如何优化]

### 优点

1. [做得好的地方]

### 总结

[整体评价和建议]
```

## 需要检查的文件

1. `src/lib/ai/agent/scoring-agent.ts`
2. `src/lib/ai/agent/sdk-tools.ts`（evaluate_quality 工具部分）
3. `src/lib/ai/agent/__tests__/scoring-agent.test.ts`
4. `scripts/test-scoring-agent.ts`
5. `src/lib/ai/agent/ingest-contract.ts`（参考：NormalizedAgentIngestDecision 类型）
6. `src/lib/ai/generate.ts`（参考：generateJSON 函数签名）
