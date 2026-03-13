# Two-Step vs Tooling 模式端到端对比分析

> 对比分析同一链接在两种推理模式下的完整处理流程
>
> - Two-Step Entry: http://localhost:3001/entry/cmmganfcj0000148we1hzt6oa
> - Tooling Entry: http://localhost:3001/entry/cmmh14ab0000085b5xo7icczo
> - 原始内容：《从构建Claude Code中汲取的教训》

## 执行概览

| 维度 | Two-Step 模式 | Tooling 模式 |
|------|--------------|--------------|
| **执行模式** | two-step (工具调用禁用) | tool-calling |
| **推理步骤** | 2 步 | 3 步 |
| **总耗时** | ~70s (Step1: 28s, Step2: 42s) | ~98s |
| **工具调用** | 0 次（纯 LLM 推理） | 2 次（classify_content + extract_summary） |
| **置信度** | 0.95 | 0.93 |

---

## 一、AI 推理过程对比（Trace）

### Two-Step 模式推理流程

**Step 1: 结构分析（28.4秒）**
```
思考：内容以 Claude Code 的构建历程为主线，围绕多个设计决策的尝试、失败、
      替代与演进展开，重点呈现工具设计如何随模型能力变化而调整，
      适合用时间线与能力演化结构总结。

动作：ANALYZE_STRUCTURE

输出：
- contentType: CASE_STUDY
- techDomain: AGENT
- aiTags: 10个（Agent, 工具调用, 动作空间, 多智能体, 子代理, 渐进式披露,
          RAG, 上下文管理, Claude Code, 系统设计）
- summaryStructure: timeline-evolution（时间线演进结构）
  - background: 构建有效 Agent 的核心难点
  - evolutionStages: 4个演进阶段
  - decisionLogic: 方案替换逻辑
  - finalInsight: 最终洞察
```

**Step 2: 知识提取（41.6秒）**
```
思考：根据结构完成知识提取

动作：EXTRACT_KNOWLEDGE

输出：
- coreSummary: 165字精炼总结
- keyPoints:
  - core: 5个核心要点
  - extended: 5个扩展要点
- summaryStructure: 完整的时间线演进结构
  - events: 4个演进阶段的详细描述（每个包含 initialApproach, problem,
           iteration, result, finalChoice）
  - decisionLogic: 决策逻辑说明
  - currentStatus: 当前状态
  - futureOutlook: 未来展望
  - finalInsight: 最终洞察
- boundaries: 适用/不适用边界
- practiceValue: KNOWLEDGE
- extractedMetadata: 作者、发布日期、参考文献
```

### Tooling 模式推理流程

**Step 1: 内容分类（工具调用）**
```
思考：先做内容分类，再按类型提取摘要。

动作：classify_content（工具调用）

观察：工具调用成功（1ms）

输出：
- contentType: CASE_STUDY
- techDomain: AGENT
- aiTags: 14个（增加了 AskUserQuestion, Task, MCP, 系统提示, 上下文腐化, Anthropic）
- summaryStructure: 初步结构判断
```

**Step 2: 摘要提取（工具调用）**
```
思考：分类完成，接着提取结构化摘要。

动作：extract_summary（工具调用）

观察：工具调用成功（0ms）

输出：
- coreSummary: 详细摘要
- keyPoints: core + extended
- summaryStructure: timeline-evolution 结构
- boundaries: 适用/不适用边界
```

**Step 3: 最终推理（纯推理）**
```
思考：（完整的 JSON 结构输出）

动作：reasoning

观察：空数组

输出：完整的结构化结果，包含：
- summaryStructure.fields.events: 5个演进阶段（比 two-step 多1个"动作空间设计起点"）
- summaryStructure.fields 包含更多维度：
  - sourceCredibility: 来源可信度评估
  - timeliness: 时效性评估
  - completeness: 完整性评估
  - contentForm: 内容形式
  - difficultyLevel: 难度等级
  - currentStatus: 当前状态（包含 state + evidence）
  - futureOutlook: 未来展望（包含 direction + openQuestions）
```

---

## 二、AI 推理结果对比

### 2.1 基础分类对比

| 字段 | Two-Step | Tooling | 差异分析 |
|------|----------|---------|----------|
| **contentType** | CASE_STUDY | CASE_STUDY | ✅ 一致 |
| **techDomain** | AGENT | AGENT | ✅ 一致 |
| **aiTags 数量** | 10个 | 14个 | Tooling 多4个 |
| **aiTags 差异** | 缺少：AskUserQuestion, Task, MCP, 系统提示, 上下文腐化, Anthropic<br>多了：子代理, 上下文管理 | 缺少：子代理, 上下文管理<br>多了：AskUserQuestion, Task, MCP, 系统提示, 上下文腐化, Anthropic | Tooling 标签更细粒度 |
| **confidence** | 0.95 | 0.93 | Two-Step 略高 |

### 2.2 核心摘要对比

**Two-Step coreSummary (165字):**
> 本文以 Claude Code 的构建历程为案例，说明 Agent 设计的关键不在堆叠功能，而在让工具、任务表示与上下文获取方式匹配模型当下能力。文章依次展示了征询工具从输出约束到 AskUserQuestion、任务管理从 Todo 到 Task、上下文构建从 RAG 到主动搜索、产品知识补充从系统提示到 Guide 子代理的演进。核心结论是：优秀 Agent 依赖持续观察模型真实行为，反复调整动作空间与信息披露方式，而非依赖固定范式。

**Tooling coreSummary (172字):**
> 本文以 Claude Code 的构建演进为主线，提炼出 Agent 工程的核心原则：工具不是越多越好，而要与模型能力边界匹配。文章通过 AskUserQuestion、Todo→Task、RAG→主动搜索、Guide Agent 等案例说明，随着模型能力提升，旧工具可能从辅助变成束缚；比起一次性灌入上下文，更有效的方法是让模型主动搜索并按需获取信息。其最终结论是，优秀 Agent 依赖持续观察、反复实验与渐进式迭代，而非预设一套静态规则。

**对比分析：**
- ✅ 核心主题一致：都强调工具与模型能力匹配
- ✅ 案例覆盖一致：AskUserQuestion、Todo→Task、RAG→搜索、Guide Agent
- 📊 表达风格：Two-Step 更学术化（"征询工具从输出约束到..."），Tooling 更口语化（"工具不是越多越好"）
- 📊 侧重点：Two-Step 强调"动作空间与信息披露"，Tooling 强调"渐进式迭代"

### 2.3 关键要点对比

#### Core 要点数量
- Two-Step: 5个核心要点
- Tooling: 5个核心要点

#### Core 要点内容对比

| # | Two-Step | Tooling | 差异 |
|---|----------|---------|------|
| 1 | Agent 工具设计的核心不是功能越多越好，而是**动作空间必须与模型当前能力严格匹配**。 | 核心洞察：Agent 工具设计的关键不是功能越多越强，而是**动作空间必须与模型当前能力边界匹配**。 | ✅ 几乎一致，Tooling 加了"核心洞察"前缀 |
| 2 | 原本为弥补模型不足而加入的工具，在模型能力增强后**可能反而成为限制**。 | 反直觉发现：曾经帮助模型稳定执行的工具，会随着模型能力提升转而变成约束，**甚至扭曲模型的决策方式**。 | 📊 Tooling 表达更强烈（"扭曲决策"） |
| 3 | 比起预先灌输上下文，让模型主动搜索并渐进式获取信息，**更适合复杂代码任务**。 | 关键结论：相比把上下文一次性喂给模型，让模型主动搜索并渐进式获取信息，**更符合高能力 Agent 的工作方式**。 | 📊 Two-Step 强调"复杂代码任务"，Tooling 强调"高能力 Agent" |
| 4 | 新增工具会显著增加模型选择成本，因此能力扩展应优先依赖**结构设计与子代理**。 | 核心原则：新增工具会增加模型选择负担，因此功能扩展应优先通过**结构设计、子代理和信息组织**完成，而非不断加工具。 | 📊 Tooling 增加了"信息组织"维度 |
| 5 | 优秀 Agent 不是一次设计完成，而是通过**持续观察模型真实行为迭代**出来的。 | 底层哲学：优秀 Agent 系统不是靠预设完美规则构建的，而是靠**持续观察模型真实行为并围绕其认知习性迭代**出来的。 | 📊 Tooling 增加了"认知习性"概念 |

#### Extended 要点对比

**Two-Step (4个扩展要点):**
1. 结构化交互是否有效，取决于模型能否稳定理解并愿意使用，而不只是格式是否规范。
2. 上下文腐化说明信息过多会直接削弱模型推理质量，按需加载比全量注入更关键。
3. 多智能体协作需要能表达依赖关系与共享状态的任务结构，线性 Todo 难以胜任。
4. 系统提示并不适合承载低频但体量大的产品知识，这类信息更适合由专门子代理处理。

**Tooling (3个扩展要点):**
1. 关键发现：结构化工具调用比依赖 Markdown 等自由文本格式更适合需要稳定解析的用户交互场景。
2. 补充洞察：任务管理工具的真正价值不在提醒模型别忘事，而在支持代理之间共享状态、表达依赖与协作关系。
3. 经验结论：将专业知识封装进专门子代理，比把大量说明塞进系统提示更能减少上下文污染并提升回答质量。

**对比分析：**
- ❌ Tooling 缺少"上下文腐化"要点（Two-Step 第2点）
- ✅ 其他要点内容基本对应，但表达方式不同
- 📊 Two-Step 更学术化，Tooling 更实践化（"关键发现"、"补充洞察"、"经验结论"）

### 2.4 summaryStructure 深度对比

#### 结构类型
- ✅ 两者都识别为 `timeline-evolution`（时间线演进）

#### Two-Step 结构字段（6个）
```
- background: 背景说明
- events: 4个演进阶段（每个包含 stage, initialApproach, problem, iteration, result, finalChoice）
- decisionLogic: 决策逻辑
- currentStatus: 当前状态
- futureOutlook: 未来展望
- finalInsight: 最终洞察
```

#### Tooling 结构字段（11个）
```
- background: 背景说明
- events: 5个演进阶段（比 Two-Step 多1个"动作空间设计起点"）
- decisionLogic: 决策逻辑
- currentStatus: 当前状态（包含 state + evidence）
- futureOutlook: 未来展望（包含 direction + openQuestions）
- sourceCredibility: 来源可信度评估 ⭐ 新增
- timeliness: 时效性评估 ⭐ 新增
- completeness: 完整性评估 ⭐ 新增
- contentForm: 内容形式 ⭐ 新增
- difficultyLevel: 难度等级 ⭐ 新增
- reasoning: 结构选择理由
```

#### Events 演进阶段对比

**Two-Step (4个阶段):**
1. 征询能力设计
2. 任务管理演进
3. 上下文构建机制
4. 产品知识补充

**Tooling (5个阶段):**
1. **动作空间设计起点** ⭐ 新增
2. AskUserQuestion 工具形成
3. Todo 到 Task 的替换
4. 从 RAG 到主动搜索
5. Guide Agent 的引入

**关键差异：**
- ✅ Tooling 增加了"动作空间设计起点"作为第一阶段，提供了更完整的背景
- ✅ Tooling 的阶段命名更具体（"AskUserQuestion 工具形成" vs "征询能力设计"）
- 📊 Two-Step 的每个阶段包含 6 个字段，Tooling 的每个阶段包含 3 个字段（focus + details）

#### 单个阶段详细度对比（以"征询能力"为例）

**Two-Step 结构:**
```json
{
  "stage": "征询能力设计",
  "initialApproach": "在 ExitPlanTool 中加入计划与问题列表参数...",
  "problem": "计划与提问逻辑耦合，用户回答可能与原计划冲突...",
  "iteration": "尝试通过 Markdown 输出格式约束问题与选项。",
  "result": "因格式不可严格保证，不适合精确 UI 交互。",
  "finalChoice": "引入专用 AskUserQuestion 工具..."
}
```

**Tooling 结构:**
```json
{
  "stage": "AskUserQuestion 工具形成",
  "focus": "围绕如何让模型稳定向用户征询信息，经历多轮方案淘汰。",
  "details": [
    "先尝试在 ExitPlanTool 中同时承载计划与提问，但计划和提问逻辑相互冲突。",
    "再尝试通过 Markdown 格式约束输出问题，但自由文本难以稳定解析，无法支撑可靠 UI。",
    "最终采用独立的 AskUserQuestion 工具，以结构化输出、多选约束和暂停执行机制实现稳定征询。"
  ]
}
```

**对比分析：**
- 📊 Two-Step 采用"问题-迭代-结果"的结构化字段，更适合程序化处理
- 📊 Tooling 采用"焦点+细节列表"的叙事结构，更适合人类阅读
- ✅ 信息内容基本一致，但组织方式不同

### 2.5 Boundaries（边界）对比

#### Applicable（适用场景）

**Two-Step (3条):**
1. 适用于 LLM Agent、代码助手、工具调用系统和多智能体协作系统的架构设计总结。
2. 适用于分析工具数量控制、上下文管理、用户征询与子代理分工等工程取舍。
3. 适用于提炼 Agent 产品从早期原型到成熟系统的演进经验与设计哲学。

**Tooling (3条):**
1. 适用于构建基于 LLM 的 Agent、代码助手、具备工具调用能力的多步骤执行系统。
2. 适用于需要设计动作空间、用户征询机制、上下文搜索策略、多代理协作机制的产品与研发团队。
3. 适用于评估何时该保留、重构或淘汰某个工具，以及如何降低系统提示和上下文负担。

**对比分析：**
- ✅ 核心适用场景一致
- 📊 Two-Step 更偏向"总结与分析"视角
- 📊 Tooling 更偏向"构建与设计"视角

#### Not Applicable（不适用场景）

**Two-Step (3条):**
1. 不适用于需要严格实验对比、量化指标复现或算法证明的研究型总结。
2. 不适用于以模型训练、微调、蒸馏或推理部署优化为主题的内容抽取。
3. 不适用于 API 文档解析、插件清单整理或带完整代码实现的实操教程归纳。

**Tooling (3条):**
1. 不适用于主要讨论模型训练算法、反向传播、预训练架构等底层深度学习机制的内容。
2. 不适用于强调单轮问答、纯 Prompt 优化而几乎不涉及工具调用与环境交互的简单应用场景。
3. 不适用于需要严格工程定量结论的决策场景，因为本文更偏实践经验总结，缺少系统化对照实验数据。

**对比分析：**
- ✅ 第1条基本一致（都排除严格量化研究）
- ✅ 第2条基本一致（都排除模型训练相关）
- 📊 Two-Step 第3条更具体（API文档、插件清单、实操教程）
- 📊 Tooling 第2条增加了"单轮问答"场景的排除

---

## 三、前端呈现对比

### 3.1 Entry 基本信息

| 字段 | Two-Step | Tooling | 前端展示差异 |
|------|----------|---------|-------------|
| **Title** | 从构建Claude Code中汲取的教训 | 从构建Claude Code中汲取的教训 | ✅ 一致 |
| **Content Type** | CASE_STUDY | CASE_STUDY | ✅ 一致 |
| **AI Tags** | 10个 | 14个 | ❌ Tooling 标签更多 |
| **Core Summary** | 165字 | 172字 | 📊 Tooling 略长 |
| **Key Points** | 9个（5 core + 4 extended） | 8个（5 core + 3 extended） | ❌ Two-Step 多1个 |
| **Confidence** | 0.95 | 0.93 | 📊 Two-Step 略高 |

### 3.2 Summary Structure 前端渲染差异

#### Two-Step 前端展示结构
```
📋 时间线演进结构
├── 背景说明
├── 4个演进阶段
│   ├── 征询能力设计
│   ├── 任务管理演进
│   ├── 上下文构建机制
│   └── 产品知识补充
├── 决策逻辑
├── 当前状态
├── 未来展望
└── 最终洞察
```

#### Tooling 前端展示结构
```
📋 时间线演进结构
├── 背景说明
├── 5个演进阶段
│   ├── 动作空间设计起点 ⭐
│   ├── AskUserQuestion 工具形成
│   ├── Todo 到 Task 的替换
│   ├── 从 RAG 到主动搜索
│   └── Guide Agent 的引入
├── 来源可信度 ⭐
├── 时效性 ⭐
├── 完整性 ⭐
├── 内容形式 ⭐
├── 难度等级 ⭐
├── 决策逻辑
├── 当前状态（state + evidence）
├── 未来展望（direction + openQuestions）
└── 结构选择理由
```

**前端呈现差异分析：**
- ✅ Tooling 提供了更多元数据维度（来源可信度、时效性、完整性、难度等级）
- ✅ Tooling 的演进阶段更完整（5个 vs 4个）
- ✅ Tooling 的 currentStatus 和 futureOutlook 结构更丰富
- ❌ Tooling 的单个阶段细节较少（3字段 vs 6字段）

### 3.3 前端用户体验对比

#### Two-Step 优势
1. ✅ **更高置信度**：0.95 vs 0.93
2. ✅ **更多扩展要点**：4个 vs 3个（包含"上下文腐化"要点）
3. ✅ **更结构化的演进阶段**：每个阶段包含 initialApproach → problem → iteration → result → finalChoice 的完整链路
4. ✅ **更适合程序化处理**：字段结构清晰，易于提取和分析

#### Tooling 优势
1. ✅ **更丰富的标签**：14个 vs 10个，覆盖更细粒度的概念
2. ✅ **更多元数据维度**：来源可信度、时效性、完整性、难度等级
3. ✅ **更完整的演进阶段**：5个 vs 4个，包含"动作空间设计起点"
4. ✅ **更丰富的结构字段**：currentStatus 包含 evidence，futureOutlook 包含 openQuestions
5. ✅ **更适合人类阅读**：focus + details 的叙事结构更自然

---

## 四、核心发现与建议

### 4.1 核心发现

#### 1. 信息量差异
- **Tooling 模式信息量更大**：14个标签 vs 10个，11个结构字段 vs 6个
- **Two-Step 模式信息更精炼**：更高置信度（0.95 vs 0.93），更少但更核心的要点

#### 2. 结构化程度差异
- **Two-Step 更适合程序化处理**：演进阶段采用固定的 6 字段结构
- **Tooling 更适合人类阅读**：采用 focus + details 的叙事结构

#### 3. 元数据丰富度差异
- **Tooling 提供了更多评估维度**：来源可信度、时效性、完整性、难度等级
- **Two-Step 缺少这些维度**：但核心内容质量更高

#### 4. 前端呈现问题
- **Tooling 的丰富信息未被充分利用**：前端没有展示来源可信度、时效性等字段
- **Two-Step 的结构化优势未体现**：前端没有突出 initialApproach → finalChoice 的演进链路

### 4.2 前端优化建议

#### 建议 1：增强 Tooling 模式的元数据展示
```tsx
// 在 Entry 详情页增加元数据卡片
<MetadataCard>
  <Badge>来源可信度: {sourceCredibility}</Badge>
  <Badge>时效性: {timeliness}</Badge>
  <Badge>完整性: {completeness}</Badge>
  <Badge>难度: {difficultyLevel}</Badge>
</MetadataCard>
```

#### 建议 2：优化演进阶段的可视化
```tsx
// Two-Step: 展示完整的演进链路
<Timeline>
  {events.map(event => (
    <TimelineItem>
      <Step label="初始方案">{event.initialApproach}</Step>
      <Step label="遇到问题">{event.problem}</Step>
      <Step label="迭代尝试">{event.iteration}</Step>
      <Step label="最终方案">{event.finalChoice}</Step>
    </TimelineItem>
  ))}
</Timeline>

// Tooling: 展示焦点+细节
<Timeline>
  {events.map(event => (
    <TimelineItem>
      <Focus>{event.focus}</Focus>
      <Details>{event.details}</Details>
    </TimelineItem>
  ))}
</Timeline>
```

#### 建议 3：增加标签筛选和对比功能
```tsx
// 展示标签差异
<TagComparison>
  <TagGroup label="Two-Step 独有">
    {twoStepOnlyTags.map(tag => <Tag>{tag}</Tag>)}
  </TagGroup>
  <TagGroup label="Tooling 独有">
    {toolingOnlyTags.map(tag => <Tag>{tag}</Tag>)}
  </TagGroup>
</TagComparison>
```

#### 建议 4：优化 Key Points 的分层展示
```tsx
// 区分 core 和 extended
<KeyPoints>
  <Section title="核心要点" badge="Core">
    {keyPoints.core.map(point => <Point>{point}</Point>)}
  </Section>
  <Section title="扩展要点" badge="Extended">
    {keyPoints.extended.map(point => <Point>{point}</Point>)}
  </Section>
</KeyPoints>
```

### 4.3 推理模式选择建议

#### 使用 Two-Step 的场景
1. ✅ 需要高置信度的结果
2. ✅ 需要结构化的演进分析（initialApproach → finalChoice）
3. ✅ 需要程序化处理和提取
4. ✅ 对推理速度要求较高（70s vs 98s）

#### 使用 Tooling 的场景
1. ✅ 需要更细粒度的标签分类
2. ✅ 需要元数据评估（来源可信度、时效性等）
3. ✅ 需要更完整的背景和演进阶段
4. ✅ 需要更适合人类阅读的叙事结构

---

## 五、总结

### 用户原始疑问验证

> "two-step前端页面的内容更丰富和体系，但tooling明显信息更多，知识前端没有很好的筛选"

**验证结果：**
1. ✅ **Tooling 信息确实更多**：14个标签 vs 10个，11个结构字段 vs 6个
2. ✅ **Two-Step 内容更体系化**：演进阶段采用 initialApproach → problem → iteration → result → finalChoice 的完整链路
3. ✅ **前端确实没有充分利用 Tooling 的丰富信息**：来源可信度、时效性、完整性、难度等级等字段未展示
4. ✅ **前端也没有充分展示 Two-Step 的结构化优势**：演进链路未可视化

### 最终建议

1. **短期优化**：增强前端对 Tooling 模式元数据的展示（来源可信度、时效性等）
2. **中期优化**：为两种模式设计差异化的前端渲染策略
   - Two-Step: 强调演进链路的可视化
   - Tooling: 强调元数据和细节的展示
3. **长期优化**：考虑混合模式，结合两者优势
   - 使用 Tooling 的工具调用获取丰富信息
   - 使用 Two-Step 的结构化方法组织信息

---

**生成时间**: 2026-03-08
**分析工具**: PostgreSQL + jq
**数据来源**: ReasoningTrace + Entry 表
