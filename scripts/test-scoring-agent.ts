/**
 * Test script for scoring-agent
 * Usage: npx tsx scripts/test-scoring-agent.ts
 */

import { evaluateDecisionQuality, type ScoringInput } from '../src/lib/ai/agent/scoring-agent';
import type { NormalizedAgentIngestDecision } from '../src/lib/ai/agent/ingest-contract';

// Test case 1: KNOWLEDGE type content
const knowledgeDecision: NormalizedAgentIngestDecision = {
  contentType: 'TECH_PRINCIPLE',
  techDomain: 'OTHER',
  aiTags: ['Transformer', 'Attention', 'Architecture'],
  coreSummary: 'Transformer 是一种基于自注意力机制的神经网络架构，彻底改变了 NLP 领域。核心创新在于抛弃了 RNN 的序列依赖，通过并行计算大幅提升训练效率。',
  keyPoints: [
    '核心洞察：自注意力机制的本质是矩阵乘法，可以并行计算',
    '反直觉发现：位置编码比 RNN 的隐式位置信息更有效',
    '关键突破：多头注意力允许模型关注不同的语义子空间',
  ],
  keyPointsNew: {
    core: [
      '核心洞察：自注意力机制的本质是矩阵乘法，可以并行计算',
      '反直觉发现：位置编码比 RNN 的隐式位置信息更有效',
      '关键突破：多头注意力允许模型关注不同的语义子空间',
    ],
    extended: [
      '技术细节：Query、Key、Value 三个矩阵的设计',
      '工程实践：Layer Normalization 和残差连接的重要性',
    ],
  },
  summaryStructure: {
    type: 'concept-mechanism-flow',
    fields: {
      concept: 'Transformer 架构',
      mechanism: '自注意力机制通过 Q、K、V 矩阵计算注意力权重',
      flow: '输入嵌入 → 位置编码 → 多头自注意力 → 前馈网络 → 输出',
    },
    reasoning: '文章主要讲解 Transformer 的核心概念、工作机制和数据流',
  },
  boundaries: {
    applicable: ['NLP 任务', '序列建模', '机器翻译'],
    notApplicable: ['传统 CNN 任务', '强化学习'],
  },
  practiceValue: 'KNOWLEDGE',
  practiceReason: '纯理论知识，讲解架构原理，无实践步骤和代码示例',
  practiceTask: null,
  difficulty: 'MEDIUM',
  sourceTrust: 'HIGH',
  timeliness: 'CLASSIC',
  contentForm: 'TEXTUAL',
  confidence: 0.85,
  extractedMetadata: {},
};

const knowledgeContent = {
  title: 'Transformer 架构详解：自注意力机制的革命',
  content: `
Transformer 是 Google 在 2017 年提出的一种基于自注意力机制的神经网络架构，发表在论文 "Attention is All You Need" 中。这一架构彻底改变了自然语言处理（NLP）领域，成为现代大语言模型（如 GPT、BERT）的基础。

## 核心创新

Transformer 的核心创新在于抛弃了传统的循环神经网络（RNN）和卷积神经网络（CNN），完全基于自注意力机制（Self-Attention）来处理序列数据。这一设计带来了两个关键优势：

1. **并行计算**：RNN 必须按顺序处理序列，而 Transformer 可以并行计算所有位置的表示，大幅提升训练效率。
2. **长距离依赖**：自注意力机制可以直接建模任意两个位置之间的关系，而 RNN 需要通过多步传递信息。

## 自注意力机制

自注意力机制的核心是通过三个矩阵（Query、Key、Value）来计算注意力权重：

1. **Query（Q）**：当前位置的查询向量
2. **Key（K）**：所有位置的键向量
3. **Value（V）**：所有位置的值向量

注意力权重的计算公式为：

Attention(Q, K, V) = softmax(QK^T / sqrt(d_k)) * V

其中 d_k 是键向量的维度，除以 sqrt(d_k) 是为了防止梯度消失。

## 多头注意力

Transformer 使用多头注意力（Multi-Head Attention），将 Q、K、V 分别投影到多个子空间，每个子空间独立计算注意力，最后拼接起来。这样可以让模型关注不同的语义子空间，捕获更丰富的信息。

## 位置编码

由于自注意力机制本身不包含位置信息，Transformer 使用位置编码（Positional Encoding）来注入位置信息。位置编码使用正弦和余弦函数，可以让模型学习到相对位置关系。

## 架构细节

Transformer 由编码器（Encoder）和解码器（Decoder）组成，每个都包含多层：

- **编码器层**：多头自注意力 + 前馈网络
- **解码器层**：掩码多头自注意力 + 编码器-解码器注意力 + 前馈网络

每一层都使用残差连接（Residual Connection）和层归一化（Layer Normalization）来稳定训练。

## 影响

Transformer 的提出标志着 NLP 领域的范式转变，催生了 BERT、GPT、T5 等一系列强大的预训练模型，也为后续的大语言模型奠定了基础。
  `.trim(),
  length: 1500,
};

// Test case 2: ACTIONABLE type content
const actionableDecision: NormalizedAgentIngestDecision = {
  contentType: 'TUTORIAL',
  techDomain: 'AGENT',
  aiTags: ['Agent', 'LangChain', 'Tool Calling'],
  coreSummary: '本教程介绍如何使用 LangChain 构建一个具有工具调用能力的 AI Agent，包括环境配置、工具定义、Agent 创建和运行测试。',
  keyPoints: [
    '核心洞察：Agent 的本质是 LLM + 工具调用 + 推理循环',
    '关键发现：工具描述的质量直接影响 Agent 的决策准确性',
  ],
  keyPointsNew: {
    core: [
      '核心洞察：Agent 的本质是 LLM + 工具调用 + 推理循环',
      '关键发现：工具描述的质量直接影响 Agent 的决策准确性',
    ],
    extended: [
      '技术要点：使用 OpenAI Functions 实现工具调用',
      '最佳实践：为每个工具提供清晰的描述和示例',
    ],
  },
  summaryStructure: {
    type: 'problem-solution-steps',
    fields: {
      problem: '如何构建一个能够调用外部工具的 AI Agent',
      solution: '使用 LangChain 框架和 OpenAI Functions',
      steps: ['安装依赖', '定义工具', '创建 Agent', '运行测试'],
    },
    reasoning: '教程类文章，有明确的问题、解决方案和实施步骤',
  },
  boundaries: {
    applicable: ['Python 开发者', '熟悉 LLM 基础', '有 API 调用经验'],
    notApplicable: ['前端开发', '不熟悉 Python'],
  },
  practiceValue: 'ACTIONABLE',
  practiceReason: '有完整的代码示例、配置文件和逐步操作指南，读者可以立即动手实践',
  practiceTask: {
    title: '构建一个天气查询 Agent',
    summary: '使用 LangChain 和 OpenAI 构建一个能够查询天气的 AI Agent',
    difficulty: 'MEDIUM',
    estimatedTime: '2小时',
    prerequisites: ['Python 3.8+', 'OpenAI API Key', 'LangChain 基础'],
    steps: [
      {
        order: 1,
        title: '安装依赖',
        description: '使用 pip 安装 langchain 和 openai 库',
      },
      {
        order: 2,
        title: '定义天气查询工具',
        description: '创建一个函数来查询天气 API',
      },
      {
        order: 3,
        title: '创建 Agent',
        description: '使用 LangChain 的 initialize_agent 创建 Agent 实例',
      },
      {
        order: 4,
        title: '运行测试',
        description: '测试 Agent 是否能正确调用工具并返回结果',
      },
    ],
  },
  difficulty: 'MEDIUM',
  sourceTrust: 'HIGH',
  timeliness: 'RECENT',
  contentForm: 'CODE_HEAVY',
  confidence: 0.88,
  extractedMetadata: {
    codeExamples: [
      {
        language: 'python',
        code: 'from langchain.agents import initialize_agent, Tool',
        description: '导入必要的库',
      },
    ],
  },
};

const actionableContent = {
  title: 'LangChain Agent 开发教程：构建天气查询 Agent',
  content: `
本教程将教你如何使用 LangChain 构建一个具有工具调用能力的 AI Agent。我们将创建一个天气查询 Agent，它能够理解用户的自然语言请求，并调用天气 API 返回结果。

## 前置要求

- Python 3.8 或更高版本
- OpenAI API Key
- 基本的 Python 编程知识

## 步骤 1：安装依赖

首先，安装必要的 Python 库：

\`\`\`bash
pip install langchain openai requests
\`\`\`

## 步骤 2：定义天气查询工具

创建一个函数来查询天气 API：

\`\`\`python
import requests

def get_weather(city: str) -> str:
    """查询指定城市的天气"""
    api_key = "your_weather_api_key"
    url = f"https://api.weatherapi.com/v1/current.json?key={api_key}&q={city}"
    response = requests.get(url)
    data = response.json()
    return f"{city} 的天气：{data['current']['condition']['text']}，温度 {data['current']['temp_c']}°C"
\`\`\`

## 步骤 3：创建 Agent

使用 LangChain 创建 Agent：

\`\`\`python
from langchain.agents import initialize_agent, Tool, AgentType
from langchain.llms import OpenAI

# 定义工具
tools = [
    Tool(
        name="Weather",
        func=get_weather,
        description="查询城市的天气信息。输入应该是城市名称。"
    )
]

# 创建 LLM
llm = OpenAI(temperature=0)

# 初始化 Agent
agent = initialize_agent(
    tools,
    llm,
    agent=AgentType.ZERO_SHOT_REACT_DESCRIPTION,
    verbose=True
)
\`\`\`

## 步骤 4：运行测试

测试 Agent：

\`\`\`python
result = agent.run("北京今天天气怎么样？")
print(result)
\`\`\`

## 工作原理

Agent 的工作流程如下：

1. 接收用户输入
2. LLM 分析输入，决定是否需要调用工具
3. 如果需要，调用相应的工具
4. 将工具返回的结果传回 LLM
5. LLM 生成最终回复

## 最佳实践

- **工具描述要清晰**：描述应该明确说明工具的功能和输入格式
- **错误处理**：为工具函数添加异常处理
- **日志记录**：使用 verbose=True 查看 Agent 的推理过程

## 总结

通过本教程，你学会了如何使用 LangChain 构建一个简单的 AI Agent。你可以扩展这个例子，添加更多工具，构建更复杂的 Agent 系统。
  `.trim(),
  length: 2000,
};

async function main() {
  console.log('🧪 Testing Scoring Agent\n');

  // Test 1: KNOWLEDGE type
  console.log('📚 Test 1: Evaluating KNOWLEDGE type content');
  console.log('Title:', knowledgeContent.title);
  console.log('Content length:', knowledgeContent.length, 'characters\n');

  try {
    const knowledgeInput: ScoringInput = {
      decision: knowledgeDecision,
      originalContent: knowledgeContent,
    };

    const knowledgeEvaluation = await evaluateDecisionQuality(knowledgeInput);

    console.log('✅ Evaluation completed');
    console.log('Overall Score:', knowledgeEvaluation.overallScore, '/100');
    console.log('Dimensions:');
    console.log('  - Completeness:', knowledgeEvaluation.dimensions.completeness);
    console.log('  - Accuracy:', knowledgeEvaluation.dimensions.accuracy);
    console.log('  - Relevance:', knowledgeEvaluation.dimensions.relevance);
    console.log('  - Clarity:', knowledgeEvaluation.dimensions.clarity);
    console.log('  - Actionability:', knowledgeEvaluation.dimensions.actionability);
    console.log('\nIssues:', knowledgeEvaluation.issues.length);
    knowledgeEvaluation.issues.forEach((issue, i) => {
      console.log(`  ${i + 1}. ${issue}`);
    });
    console.log('\nSuggestions:', knowledgeEvaluation.suggestions.length);
    knowledgeEvaluation.suggestions.forEach((suggestion, i) => {
      console.log(`  ${i + 1}. ${suggestion}`);
    });
    console.log('\nReasoning:', knowledgeEvaluation.reasoning);
    console.log('\n' + '='.repeat(80) + '\n');
  } catch (error) {
    console.error('❌ Test 1 failed:', error);
    process.exit(1);
  }

  // Test 2: ACTIONABLE type
  console.log('🛠️  Test 2: Evaluating ACTIONABLE type content');
  console.log('Title:', actionableContent.title);
  console.log('Content length:', actionableContent.length, 'characters\n');

  try {
    const actionableInput: ScoringInput = {
      decision: actionableDecision,
      originalContent: actionableContent,
    };

    const actionableEvaluation = await evaluateDecisionQuality(actionableInput);

    console.log('✅ Evaluation completed');
    console.log('Overall Score:', actionableEvaluation.overallScore, '/100');
    console.log('Dimensions:');
    console.log('  - Completeness:', actionableEvaluation.dimensions.completeness);
    console.log('  - Accuracy:', actionableEvaluation.dimensions.accuracy);
    console.log('  - Relevance:', actionableEvaluation.dimensions.relevance);
    console.log('  - Clarity:', actionableEvaluation.dimensions.clarity);
    console.log('  - Actionability:', actionableEvaluation.dimensions.actionability);
    console.log('\nIssues:', actionableEvaluation.issues.length);
    actionableEvaluation.issues.forEach((issue, i) => {
      console.log(`  ${i + 1}. ${issue}`);
    });
    console.log('\nSuggestions:', actionableEvaluation.suggestions.length);
    actionableEvaluation.suggestions.forEach((suggestion, i) => {
      console.log(`  ${i + 1}. ${suggestion}`);
    });
    console.log('\nReasoning:', actionableEvaluation.reasoning);
    console.log('\n' + '='.repeat(80) + '\n');
  } catch (error) {
    console.error('❌ Test 2 failed:', error);
    process.exit(1);
  }

  console.log('✅ All tests passed!');
}

main().catch(console.error);
