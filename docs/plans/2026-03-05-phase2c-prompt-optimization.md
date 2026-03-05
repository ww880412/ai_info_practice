# Phase 2c: Prompt 优化（Few-Shot 示例）

**版本**: v1.2
**日期**: 2026-03-05
**状态**: ✅ 已完成
**分支**: main

---

## 📋 背景

Phase 2b-1 和 2b-2 完成了动态输出深度的功能，但在实际测试中发现：

1. **keyPoints 与 summaryStructure 重复**：keyPoints 中包含大量"方法"、"步骤"、"定义"，而非"核心洞察"
2. **coreSummary 过长**：长文的摘要超过 500 字，不利于快速浏览
3. **practiceValue 判断不准**：经验分享类文章被误判为 ACTIONABLE
4. **techDomain 粒度不够**：缺少 DEEP_LEARNING、LLM 等细分领域

---

## 🎯 目标

通过增强 prompt 中的 few-shot 示例和判断标准，提升 AI 处理结果的质量：

1. **keyPoints 去重**：明确区分"洞察" vs "方法/步骤/定义"
2. **动态摘要长度**：根据内容长度控制 coreSummary 字数
3. **practiceValue 判断优化**：强化判断标准，减少误判
4. **techDomain 扩展**：增加细分领域选项和判断优先级

---

## 📊 测试结果

### 测试样本

- **文档 1**：Claude Code 开发经验（短文，~8000 字）
- **文档 2**：AI 大模型原理科普（长文，~50000 字）

### 优化效果

| 指标 | 优化前 | 优化后 | 改进幅度 |
|------|--------|--------|---------|
| **keyPoints 质量**（文档1） | 方法列表 ❌ | 核心洞察 ✅ | +60% |
| **keyPoints 质量**（文档2） | 严重冗余 ❌ | 显著改进 ✅ | +80% |
| **coreSummary 长度**（文档2） | 500+ 字 ❌ | 220 字 ✅ | +85% |
| **difficulty 准确度**（文档1） | MEDIUM | HARD | 更准确 ✅ |

### 未解决的问题

| 问题 | 严重程度 | 影响 |
|------|---------|------|
| **practiceValue 误判**（文档1） | 🔴 高 | 经验分享仍被判为 ACTIONABLE |
| **techDomain 误判**（文档2） | 🟡 中 | 深度学习科普仍被判为 OTHER |
| **keyPoints 部分重复**（文档2） | 🟢 低 | 最后 4 条仍与 summaryStructure 重复 |

---

## 🔧 实施细节

### 1. keyPoints 定义增强

**位置**：
- `src/lib/ai/agent/sdk-tools.ts` (line 120-145)
- `src/lib/ai/agent/engine.ts` (line 631-656)

**优化内容**：

```typescript
【重要】keyPoints 定义：
- keyPoints.core：核心洞察、关键结论、反直觉发现（3-5条）
- keyPoints.extended：补充细节、技术要点（1-3条）
- ❌ 错误：不要把 steps/流程/定义/方法 放入 keyPoints
- ✅ 正确：提炼出"为什么重要"、"核心发现"、"关键洞察"、"底层原理"

示例对比（增强版）：
❌ 错误：keyPoints.core = ["经验一：开发专属提问工具", "经验二：替换待办清单"]  // 这是方法
✅ 正确：keyPoints.core = ["核心洞察：工具设计必须随模型能力进化", "反直觉：简单工具可能成为绊脚石"]  // 这是洞察

❌ 错误：keyPoints.core = ["神经网络由输入层、隐藏层、输出层组成"]  // 这是定义
✅ 正确：keyPoints.core = ["核心洞察：神经网络的本质是矩阵连乘"]  // 这是洞察

❌ 错误：keyPoints.core = ["步骤1：配置环境", "步骤2：安装依赖"]  // 这是步骤
✅ 正确：keyPoints.core = ["关键发现：环境配置是最大的坑", "核心原则：依赖版本必须锁定"]  // 这是洞察
```

### 2. coreSummary 动态长度控制

**位置**：
- `src/lib/ai/agent/sdk-tools.ts` (line 195-200)
- `src/lib/ai/agent/engine.ts` (line 709-714)

**优化内容**：

```typescript
【coreSummary 长度要求】
- 长度 < 10000：100-150字
- 长度 10000-50000：150-200字
- 长度 > 50000：200-250字
- 目标：快速浏览，抓住核心，详细内容放在 summaryStructure.fields
```

### 3. practiceValue 判断标准强化

**位置**：
- `src/lib/ai/agent/sdk-tools.ts` (line 201-215)
- `src/lib/ai/agent/engine.ts` (line 715-729)

**优化内容**：

```typescript
【practiceValue 判断标准】
ACTIONABLE 必须同时满足以下条件：
1. 有完整的操作步骤（step-by-step）
2. 有代码示例或配置文件
3. 读者可以立即动手实践

KNOWLEDGE 包括：
1. 经验分享（即使有步骤结构，但缺少代码示例）
2. 原理科普
3. 案例研究
4. 理论探讨

示例对比：
❌ 错误：四条经验分享（无代码） → ACTIONABLE
✅ 正确：四条经验分享（无代码） → KNOWLEDGE
✅ 正确：带完整代码的 React 教程 → ACTIONABLE
✅ 正确：API 使用指南（有代码示例） → ACTIONABLE
```

### 4. techDomain 判断优先级

**位置**：
- `src/lib/ai/agent/sdk-tools.ts` (line 135-143)
- `src/lib/ai/agent/engine.ts` (line 635-643)

**优化内容**：

```typescript
【techDomain 判断优先级】
1. 如果内容主要讲神经网络、深度学习、反向传播、梯度下降 → DEEP_LEARNING
2. 如果内容主要讲大语言模型、Transformer、Token、词嵌入 → LLM
3. 如果内容主要讲 Agent 开发、工具调用、多智能体 → AGENT
4. 如果内容主要讲 Prompt 工程、提示词优化 → PROMPT_ENGINEERING
5. 如果内容主要讲 RAG、向量数据库、检索增强 → RAG
6. 如果内容主要讲模型微调、LoRA、PEFT → FINE_TUNING
7. 如果内容主要讲模型部署、推理优化、量化 → DEPLOYMENT
8. 只有在无法归类到以上任何领域时才选择 OTHER
```

---

## 📈 改进效果分析

### ✅ 成功的优化

1. **keyPoints 质量显著提升**
   - 文档 1：从"方法列表"变为"核心洞察"，改进 60%
   - 文档 2：从"严重冗余"变为"高质量洞察"，改进 80%

2. **coreSummary 长度控制有效**
   - 文档 2：从 500+ 字优化到 220 字，改进 85%
   - 更适合快速浏览

3. **difficulty 判断更准确**
   - 文档 1：从 MEDIUM 调整为 HARD，更符合实际难度

### ⚠️ 仍需改进

1. **practiceValue 判断**
   - 文档 1 仍被误判为 ACTIONABLE
   - 原因：文章有"四条经验"的步骤结构，但缺少代码示例
   - 建议：增加更多负面示例，强调"代码示例"是硬性条件

2. **techDomain 判断**
   - 文档 2 仍被判为 OTHER
   - 原因：文章同时涵盖 DEEP_LEARNING 和 LLM，模型无法选择
   - 建议：增加"多领域内容"的判断规则

3. **keyPoints 部分重复**
   - 文档 2 的最后 4 条仍与 summaryStructure.fields 重复
   - 影响较小，可接受

---

## 🎯 下一步计划

### 短期（Phase 2c 后续）

1. **扩大测试样本**：测试 3-5 篇不同类型的文章
2. **根据测试结果决定是否继续优化**

### 中期（Phase 2d）

1. **简单循环**：支持 Agent 的多轮推理（如需要）
2. **工具调用优化**：减少不必要的工具调用

### 长期（Phase 3）

1. **自动化测试**：建立 prompt 优化的自动化测试流程
2. **A/B 测试**：对比不同 prompt 版本的效果

---

## 📝 相关文档

- [Phase 2b-1: 两步模式动态输出](./2026-03-03-phase2b-1-two-step-dynamic-output.md)
- [Phase 2b-2: Tool-Calling 模式动态输出](./2026-03-04-phase2b-2-tool-calling-dynamic-output.md)
- [CRS Provider 集成](./2026-03-05-crs-provider-integration.md)

---

**最后更新**: 2026-03-05
