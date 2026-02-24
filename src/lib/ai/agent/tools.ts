import { z } from 'zod';
import type { AgentContext } from './types';

type ToolParams = Record<string, unknown>;

function isToolParams(value: unknown): value is ToolParams {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export interface Tool {
  name: string;
  description: string;
  parameters: z.ZodSchema;
  handler: (params: ToolParams, context: AgentContext) => Promise<ToolResult>;
}

export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

export class ToolsRegistry {
  private tools: Map<string, Tool> = new Map();

  register(tool: Tool) {
    this.tools.set(tool.name, tool);
  }

  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  list(): Tool[] {
    return Array.from(this.tools.values());
  }

  async execute(action: string, params: unknown, context: AgentContext): Promise<ToolResult> {
    const tool = this.tools.get(action);

    if (!tool) {
      return { success: false, error: `Tool ${action} not found` };
    }

    try {
      const validatedParams = tool.parameters.parse(params);
      if (!isToolParams(validatedParams)) {
        return { success: false, error: `Invalid params for tool ${action}` };
      }
      const result = await tool.handler(validatedParams, context);
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

export const toolsRegistry = new ToolsRegistry();
