import { prisma } from '@/lib/prisma';
import { getDefaultConfig } from './config';
import type { AgentConfig } from './types';

export async function getAgentConfig(): Promise<AgentConfig> {
  const saved = await prisma.agentConfig.findFirst({
    where: { isDefault: true },
  });

  if (saved) {
    return saved.config as unknown as AgentConfig;
  }

  return getDefaultConfig();
}
