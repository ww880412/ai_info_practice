import { prisma } from '@/lib/prisma';
import { getDefaultConfig } from './config';
import type { AgentConfig } from './types';

/**
 * Phase 2a: 从环境变量读取工具调用开关
 * 默认启用，设置 REACT_AGENT_USE_TOOLS=false 可禁用
 * CRS provider 不支持结构化输出，自动禁用 tool-calling
 */
function readUseToolCallingFromEnv(): boolean {
  // CRS provider 不支持结构化输出，强制禁用 tool-calling
  if (process.env.USE_CRS_PROVIDER === 'true') {
    return false;
  }
  return process.env.REACT_AGENT_USE_TOOLS !== 'false';
}

export async function getAgentConfig(): Promise<AgentConfig> {
  const base = getDefaultConfig();
  const saved = await prisma.agentConfig.findFirst({
    where: { isDefault: true },
  });

  const dbConfig = saved?.config as Partial<AgentConfig> | undefined;

  return {
    ...base,
    ...(dbConfig ?? {}),
    // Phase 2a: 强制 env 优先，不被 DB 配置覆盖
    useToolCalling: readUseToolCallingFromEnv(),
  };
}
