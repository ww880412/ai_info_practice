import type { AgentConfig, AgentContext, ReasoningStep, ReasoningTrace } from './types';
import type { ParseResult } from '../../parser/index';
import { toolsRegistry } from './tools';
import { getGeminiModel } from '../../gemini';
import { prisma } from '../../prisma';

interface ParsedAction {
  action: string;
  params: Record<string, unknown>;
}

interface ParsedAgentResponse {
  thought: string;
  action: ParsedAction;
  reasoning: string;
  observation: string;
  final: unknown | null;
}

function parseJSONSafely(raw: string): unknown | null {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function parseAgentResponse(response: string): ParsedAgentResponse {
  const thoughtMatch = response.match(/THINK:\s*([\s\S]*?)(?=\n(?:ACTION|REASONING|OBSERVATION|FINAL):|$)/);
  const actionMatch = response.match(/ACTION:\s*([a-zA-Z0-9_]+)\s*([\s\S]*?)(?=\n(?:REASONING|OBSERVATION|FINAL):|$)/);
  const reasoningMatch = response.match(/REASONING:\s*([\s\S]*?)(?=\n(?:OBSERVATION|FINAL):|$)/);
  const observationMatch = response.match(/OBSERVATION:\s*([\s\S]*?)(?=\nFINAL:|$)/);
  const finalMatch = response.match(/FINAL:\s*([\s\S]*)$/);

  let actionParams: Record<string, unknown> = {};
  if (actionMatch?.[2]?.trim()) {
    const parsed = parseJSONSafely(actionMatch[2].trim());
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      actionParams = parsed as Record<string, unknown>;
    }
  }

  let final: unknown | null = null;
  if (finalMatch?.[1]?.trim()) {
    const parsedFinal = parseJSONSafely(finalMatch[1].trim());
    final = parsedFinal ?? finalMatch[1].trim();
  }

  return {
    thought: thoughtMatch?.[1]?.trim() || '',
    action: {
      action: actionMatch?.[1]?.trim() || '',
      params: actionParams,
    },
    reasoning: reasoningMatch?.[1]?.trim() || '',
    observation: observationMatch?.[1]?.trim() || '',
    final,
  };
}

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
      const parsed = parseAgentResponse(llmResponse);
      const { thought, action, reasoning, final } = parsed;

      if (final !== null) {
        finalResult = final;
        steps.push({
          step: iteration,
          timestamp: new Date().toISOString(),
          thought,
          action: action.action || 'FINAL',
          observation: parsed.observation || 'FINAL result emitted by model',
          reasoning,
          context: { inputLength: input.content.length },
        });
        isDone = true;
        break;
      }

      let observation: string;
      try {
        if (!action.action) {
          throw new Error('Missing ACTION in model response');
        }

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

      isDone = this.checkDone(steps, finalResult);

      if (isDone) {
        finalResult = this.extractResult(steps) ?? finalResult;
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
FINAL: [最终结果 JSON]

FINAL JSON 必须严格包含以下字段：
{
  "contentType": "TUTORIAL" | "TOOL_RECOMMENDATION" | "TECH_PRINCIPLE" | "CASE_STUDY" | "OPINION",
  "techDomain": "PROMPT_ENGINEERING" | "AGENT" | "RAG" | "FINE_TUNING" | "DEPLOYMENT" | "OTHER",
  "aiTags": ["string"],
  "coreSummary": "string",
  "keyPoints": ["string"],
  "practiceValue": "KNOWLEDGE" | "ACTIONABLE",
  "practiceReason": "string",
  "practiceTask": null | {
    "title": "string",
    "summary": "string",
    "difficulty": "EASY" | "MEDIUM" | "HARD",
    "estimatedTime": "string",
    "prerequisites": ["string"],
    "steps": [
      { "order": 1, "title": "string", "description": "string" }
    ]
  }
}

约束：
- 返回严格 JSON，不要 markdown，不要代码块。
- 如果 practiceValue=KNOWLEDGE，则 practiceTask 必须为 null。
- 如果 practiceValue=ACTIONABLE，优先输出完整 practiceTask。`;
  }

  private buildUserPrompt(input: ParseResult): string {
    return `内容标题：${input.title}
内容类型：${input.sourceType}
内容长度：${input.content.length} 字符

内容：
${input.content.slice(0, 3000)}`;
  }

  private checkDone(steps: ReasoningStep[], finalResult: unknown): boolean {
    if (finalResult !== null) return true;
    const lastStep = steps[steps.length - 1];
    if (!lastStep) return false;
    return lastStep.action === 'store_knowledge' && !lastStep.observation.startsWith('Error:');
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
    await prisma.reasoningTrace.create({
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
