import type { AgentConfig, AgentContext, ReasoningStep, ReasoningTrace } from './types';
import type { ParseResult } from '../../parser/index';
import { toolsRegistry } from './tools';
import { getGeminiModel } from '../../gemini';
import { prisma } from '../../prisma';

export class ReActAgent {
  private config: AgentConfig;
  private maxIterations: number;

  constructor(config: AgentConfig) {
    this.config = config;
    this.maxIterations = config.maxIterations || 10;
  }

  async process(entryId: string, input: ParseResult): Promise<ReasoningTrace> {
    const steps: ReasoningStep[] = [];
    const startTime = new Date().toISOString();
    const toolsUsed: string[] = [];

    const context: AgentContext = {
      input,
      evaluations: {},
      observations: [],
      history: steps,
    };

    const systemPrompt = this.buildSystemPrompt();
    const userPrompt = this.buildUserPrompt(input);

    let iteration = 0;
    let isDone = false;
    let finalResult: unknown = null;

    while (!isDone && iteration < this.maxIterations) {
      iteration++;

      const llmResponse = await this.callLLM(systemPrompt, userPrompt, context);
      const { thought, action, reasoning } = this.parseLLMResponse(llmResponse);

      let observation: string;
      try {
        const toolResult = await toolsRegistry.execute(action.action, action.params, context);
        observation = toolResult.success
          ? JSON.stringify(toolResult.data)
          : `Error: ${toolResult.error}`;

        if (!toolsUsed.includes(action.action)) {
          toolsUsed.push(action.action);
        }
      } catch (error) {
        observation = `Error: ${error instanceof Error ? error.message : String(error)}`;
      }

      steps.push({
        step: iteration,
        timestamp: new Date().toISOString(),
        thought,
        action: action.action,
        observation,
        reasoning,
        context: { inputLength: input.content.length },
      });

      isDone = this.checkDone(steps, context);

      if (isDone) {
        finalResult = this.extractResult(steps);
      }

      context.observations.push(observation);
    }

    const trace = await this.saveTrace(entryId, input, steps, finalResult, {
      startTime,
      endTime: new Date().toISOString(),
      iterations: iteration,
      toolsUsed,
    });

    return trace;
  }

  private buildSystemPrompt(): string {
    const tools = this.config.availableTools.map(t => `- ${t}`).join('\n');
    const dimensions = this.config.evaluationDimensions
      .filter(d => d.enabled)
      .map(d => `- ${d.name}: ${d.description}`)
      .join('\n');
    const strategies = this.config.processingStrategies
      .map(s => `- ${s.type}: ${s.condition}`)
      .join('\n');

    return `你是一个知识管理专家。根据内容特征，动态选择处理方式。

## 可用工具
${tools}

## 评估维度
${dimensions}

## 处理策略
${strategies}

## 输出格式
每一步用以下格式：
THINK: [你的思考]
ACTION: [工具名] [参数 JSON]
REASONING: [决策理由]
OBSERVATION: [工具返回结果]

完成时用：
FINAL: [最终结果 JSON]`;
  }

  private buildUserPrompt(input: ParseResult): string {
    return `内容标题：${input.title}
内容类型：${input.sourceType}
内容长度：${input.content.length} 字符

内容：
${input.content.slice(0, 3000)}`;
  }

  private parseLLMResponse(response: string) {
    const thoughtMatch = response.match(/THINK:\s*([\s\S]*?)(?=ACTION:|$)/);
    const actionMatch = response.match(/ACTION:\s*(\w+)\s*(.*)/);
    const reasoningMatch = response.match(/REASONING:\s*([\s\S]*?)(?=OBSERVATION:|$)/);
    const observationMatch = response.match(/OBSERVATION:\s*([\s\S]*?)(?=FINAL:|$)/);

    let actionParams: Record<string, unknown> = {};
    try {
      if (actionMatch?.[2]) {
        actionParams = JSON.parse(actionMatch[2].trim());
      }
    } catch {
      // Invalid JSON, use empty object
    }

    return {
      thought: thoughtMatch?.[1]?.trim() || '',
      action: {
        action: actionMatch?.[1]?.trim() || '',
        params: actionParams,
      },
      reasoning: reasoningMatch?.[1]?.trim() || '',
      observation: observationMatch?.[1]?.trim() || '',
    };
  }

  private checkDone(steps: ReasoningStep[], context: AgentContext): boolean {
    const lastStep = steps[steps.length - 1];
    if (!lastStep) return false;
    return lastStep.observation.includes('FINAL:') || lastStep.action === 'store_knowledge';
  }

  private extractResult(steps: ReasoningStep[]): unknown {
    const lastStep = steps[steps.length - 1];
    if (!lastStep) return null;

    const finalMatch = lastStep.observation.match(/FINAL:\s*([\s\S]*)/);
    if (finalMatch) {
      try {
        return JSON.parse(finalMatch[1]);
      } catch {
        return finalMatch[1];
      }
    }
    return null;
  }

  private async callLLM(system: string, user: string, context: AgentContext) {
    const model = getGeminiModel();
    const history = context.history.map(s =>
      `Step ${s.step}: ${s.thought}\nAction: ${s.action}\nObservation: ${s.observation}`
    ).join('\n\n');

    const prompt = `${system}\n\n历史步骤:\n${history}\n\n当前:\n${user}`;
    const result = await model.generateContent(prompt);
    return result.response.text();
  }

  private async saveTrace(
    entryId: string,
    input: ParseResult,
    steps: ReasoningStep[],
    finalResult: unknown,
    metadata: ReasoningTrace['metadata']
  ): Promise<ReasoningTrace> {
    const trace = await prisma.reasoningTrace.create({
      data: {
        entryId,
        steps: JSON.stringify(steps),
        finalResult: JSON.stringify(finalResult),
        metadata: JSON.stringify(metadata),
      },
    });

    return {
      entryId,
      input,
      steps,
      finalResult,
      metadata,
    };
  }
}
