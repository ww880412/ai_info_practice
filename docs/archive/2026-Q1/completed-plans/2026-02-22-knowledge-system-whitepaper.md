# AI Knowledge Management System - 白皮书

> **版本**: v1.0
> **日期**: 2026-02-22
> **状态**: Draft

---

## 1. 系统愿景

### 1.1 核心定位

**智能知识管理系统** - 不仅仅是存储，更是让知识"活起来"。

我们认为知识的价值在于：
- **找得到** - 精准分类，快速检索
- **读得懂** - 结构清晰，重点突出
- **用得上** - 有实践路径，能关联其他知识
- **可迭代** - 根据反馈持续优化

### 1.2 目标用户

- AI 从业者（工程师、产品经理、研究者）
- 需要持续学习 AI 相关知识的技术人员
- 希望建立个人知识体系的知识工作者

---

## 2. 核心概念

### 2.1 什么是"知识"？

在这个系统里，知识包含三个层次：

| 层次 | 定义 | 用户态度 |
|------|------|----------|
| **事实** | 客观存在的信息 | 知道即可 |
| **方法** | 可操作的做法/步骤 | 需要实践 |
| **观点** | 主观看法的阐述 | 需要判断 |

**更本质的定义**：知识是"能帮助用户做决策或行动的信息"。

### 2.2 知识的维度

一条知识应该包含以下维度：

| 维度 | 说明 |
|------|------|
| 核心摘要 | 一句话说明这是什么（30-50字） |
| 知识类型 | 事实/方法/概念/观点 |
| 适用边界 | 适用场景 + 不适用场景 |
| 结构化要点 | 分层：必须掌握 / 扩展了解 |
| 实践价值 | 可actionable的程度 |
| 关联发现 | 与已有知识的连接 |
| 验证方式 | 怎么确认学会了 |
| 置信度 | 来源可信度 × 内容完整度 |

---

## 3. 输入处理框架

### 3.1 输入因素矩阵

不同质量、不同长度的文档，产出的内容应该不同：

| 输入因素 | 影响 |
|----------|------|
| 文档长度 | 决定产出详细程度 |
| 文档质量 | 决定总结深度 |
| 来源可信度 | 影响置信度标记 |
| 内容形式 | 影响解析策略选择 |

### 3.2 领域识别（第一层）

```
输入 → 领域分类
       ↓
   AI领域 → 细分到技术主题 (Agent/RAG/Prompt/微调/部署)
   产品领域 → 细分到方向 (策略/交互/增长/数据)
   其他 → 通用处理
```

**当前范围**：以 AI 领域为主，逐步扩展。

### 3.3 内容类型与处理策略（第二层）

| 类型 | 处理策略 | 期望产出结构 |
|------|----------|-------------|
| **教程/Tutorial** | PRACTICE | 问题→方案→步骤→代码 |
| **工具推荐** | COLLECTION | 工具名→功能→优缺点→适用场景 |
| **技术原理** | NOTE | 概念→核心机制→流程→边界 |
| **案例分析** | RESEARCH | 背景→做法→结果→启发 |
| **观点评论** | NOTE | 观点→论据→反驳→适用条件 |

### 3.4 动态总结结构（第三层）

根据内容特征动态决定输出结构，不固定字段：

```
内容分析 → 推理最佳总结方案 → 按该结构输出

示例：
- 入门科普文 → "概念 + 优点 + 应用场景"
- 源码解析文 → "核心原理 + 关键代码 + 流程图"
- 最佳实践 → "问题背景 + 解决方案 + 避坑指南"
```

---

## 4. 评估维度体系

### 4.1 当前评估维度

| 维度 | 说明 | 权重 |
|------|------|------|
| 来源可信度 | 评估内容来源的权威性 | 0.2 |
| 时效性 | 评估内容的时效性 | 0.15 |
| 完整度 | 评估内容完整程度 | 0.2 |
| 内容形式 | 识别主要内容形式 | 0.15 |
| 难度级别 | 评估内容难度 | 0.2 |

### 4.2 扩展维度（未来）

| 维度 | 说明 |
|------|------|
| 置信度 | 综合评分 |
| 实践价值 | 可操作程度 |
| 独特性 | 与已有知识的重复度 |
| 学习优先级 | 建议学习顺序 |

---

## 5. Agent 架构设计

### 5.1 整体架构

```
┌─────────────────────────────────────────────────────────────────────┐
│                      Knowledge Ingestion Flow                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐       │
│  │   Input      │────▶│   Parsing    │────▶│   AI Agent   │       │
│  │  (URL/File/  │     │   Layer      │     │   Processing │       │
│  │   Text)      │     │              │     │   Layer      │       │
│  └──────────────┘     └──────────────┘     └──────────────┘       │
│                              │                     │                 │
│                              ▼                     ▼                 │
│                      ┌──────────────┐     ┌──────────────┐         │
│                      │  Parse      │     │  ReAct Loop  │         │
│                      │  Strategy   │     │  + Tools     │         │
│                      │  Selection  │     │  + Config    │         │
│                      └──────────────┘     └──────────────┘         │
│                                               │                     │
│                                               ▼                     │
│                                      ┌──────────────┐              │
│                                      │  Reasoning   │              │
│                                      │  Trace       │              │
│                                      │  (白盒记录)   │              │
│                                      └──────────────┘              │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 5.2 ReAct Agent Workflow

```
┌─────────────────────────────────────────────────────────────┐
│                  Knowledge Agent (ReAct)                    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   ┌──────┐    ┌──────┐    ┌──────────┐                    │
│   │Thought│───▶│Action│───▶│Observation│                   │
│   └──────┘    └──────┘    └──────────┘                    │
│       │                                      │              │
│       └───────────────◀──────────────────────┘              │
│                   (Loop until done)                         │
│                                                              │
└─────────────────────────────────────────────────────────────┘

Step 1: 领域识别 → 判断属于哪个领域/主题
Step 2: 内容分析 → 分析内容特征（长度/质量/形式）
Step 3: 类型判断 → 确定内容类型（教程/工具/原理/案例/观点）
Step 4: 策略选择 → 选择处理策略（NOTE/PRACTICE/COLLECTION/RESEARCH）
Step 5: 结构推理 → 推理最佳总结结构
Step 6: 知识提取 → 按推理的结构提取知识
Step 7: 关联发现 → 检查与已有知识的关联
```

### 5.3 工具注册

| 工具 | 功能 |
|------|------|
| evaluate_dimension | 评估内容某维度 |
| classify_content | 内容分类 |
| extract_summary | 提取摘要 |
| route_to_strategy | 策略路由 |
| generate_practice | 生成实践任务 |
| extract_notes | 提取知识笔记 |
| find_relations | 查找关联知识 |
| store_knowledge | 存储到知识库 |

### 5.4 输出结构

Agent 输出应该包含：

```typescript
interface KnowledgeEntry {
  // 基础信息
  id: string;
  title: string;
  source: string;
  sourceTrust: 'HIGH' | 'MEDIUM' | 'LOW';

  // 内容分析
  domain: string;                    // 领域
  contentType: string;               // 内容类型
  difficulty: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'EXPERT';
  form: 'TEXTUAL' | 'CODE_HEAVY' | 'VISUAL' | 'MULTIMODAL';
  timeliness: 'RECENT' | 'OUTDATED' | 'CLASSIC';

  // 动态总结结构（核心创新点）
  summaryStructure: {
    type: 'problem-solution' | 'concept-flow' | 'background-result' | ...;
    fields: Record<string, any>;       // 根据 type 动态决定
  };

  // 核心产出
  coreSummary: string;                // 核心摘要
  keyPoints: {                        // 分层要点
    core: string[];                  // 必须掌握
    extended: string[];              // 扩展了解
  };
  boundaries: {                       // 适用边界
   适用: string[];
   不适用: string[];
  };

  // 实践相关
  practiceValue: 'KNOWLEDGE' | 'ACTIONABLE';
  practiceTask?: PracticeTask;        // 仅 ACTIONABLE

  // 关联
  relatedEntries: string[];          // 关联知识 ID

  // 元数据
  confidence: number;                 // 综合置信度
  processingStrategy: string;         // 使用的策略
  reasoningTrace: ReasoningStep[];   // 推理过程
}
```

---

## 6. 数据模型

### 6.1 Entry 表

```prisma
model Entry {
  id              String   @id @default(cuid())
  title           String
  source          String
  sourceTrust     TrustLevel @default(MEDIUM)

  // 内容分析
  domain          String
  contentType     ContentType
  difficulty      Difficulty
  form            ContentForm
  timeliness      Timeliness @default(RECENT)

  // 动态总结（JSONB）
  summaryStructure Json

  // 核心产出
  coreSummary     String   @db.Text
  keyPoints       Json     // { core: [], extended: [] }
  boundaries      Json     // { applicable: [], notApplicable: [] }

  // 实践
  practiceValue   PracticeValue
  practiceTask    PracticeTask?

  // 关联
  relatedEntries  String[]

  // 元数据
  confidence      Float?
  processingStrategy String?
  createdAt      DateTime @default(now())
  updatedAt       DateTime @updatedAt
}
```

### 6.2 ReasoningTrace 表

```prisma
model ReasoningTrace {
  id          String   @id @default(cuid())
  entryId     String
  steps       Json     // ReasoningStep[]
  finalResult Json     // 最终处理结果
  metadata    Json     // { startTime, iterations, toolsUsed }
  createdAt   DateTime @default(now())
}
```

### 6.3 ParseLog 表

```prisma
model ParseLog {
  id            String   @id @default(cuid())
  entryId       String
  strategy      String
  inputSize     Int
  outputSize    Int
  processingTime Int
  success       Boolean
  error         String?
  createdAt     DateTime @default(now())
}
```

---

## 7. 可迭代机制

### 7.1 配置动态化

| 可配置项 | 当前 | 目标 |
|---------|------|------|
| 评估维度 | 5个固定 | 可添加/删除/调整权重 |
| 处理策略 | 5种固定 | 可自定义新策略 |
| 输出结构 | 固定schema | 动态推理 |

### 7.2 反馈闭环

```
用户反馈 → 标记质量 → 定期回顾 → 调整配置
    ↓
改进 prompt / 权重 / 策略
```

### 7.3 效果追踪

- 使用率统计：哪些知识被查看/实践
- 反馈收集：用户标记"有帮助"/"没帮助"
- 定期review：月度回顾，迭代流程

---

## 8. 实施路线

### Phase 1: 基础能力（当前）
- [x] ReAct Engine
- [x] 工具注册
- [x] 配置管理
- [x] 5个评估维度
- [x] 5种处理策略

### Phase 2: 动态总结（下一步）
- [ ] 实现总结结构推理
- [ ] 按内容类型动态输出
- [ ] 分层要点提取

### Phase 3: 智能化
- [ ] 置信度计算
- [ ] 关联发现自动化
- [ ] 反馈学习机制

### Phase 4: 扩展
- [ ] 领域扩展（AI → 产品/其他）
- [ ] 配置界面化
- [ ] 自定义工作流

---

## 9. 成功指标

| 指标 | 目标 |
|------|------|
| 检索准确率 | > 85% |
| 总结满意度 | > 80% 用户认可 |
| 实践完成率 | > 60% 生成的练习被尝试 |
| 知识覆盖率 | 3个月内建立 500+ 条知识 |

---

## Appendix A: 术语表

| 术语 | 定义 |
|------|------|
| ReAct | Reasoning + Acting，一种让模型循环推理并执行动作的模式 |
| 总结结构 | 知识的组织形式，如"问题-方案-步骤" |
| 置信度 | 对知识质量的综合评分 |
| 关联发现 | 自动识别新知识与已有知识的关系 |

---

## Appendix B: 参考资料

- ReAct: Synergizing Reasoning and Acting in Language Models
- Chain-of-Thought Prompting Elicits Reasoning in Large Language Models
- Self-Consistency Improves Chain-of-Thought Reasoning in Language Models
