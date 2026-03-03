/**
 * Phase 2a: Agent Config 迁移脚本
 * 同步数据库默认配置，确保 availableTools 与实际实现一致
 */
import type { Prisma } from '@prisma/client';
import { prisma } from '../src/lib/prisma';
import { getDefaultConfig } from '../src/lib/ai/agent/config';

async function main() {
  console.log('Starting agent config migration...');

  const defaultConfig = getDefaultConfig();
  console.log('Default config tools:', defaultConfig.availableTools);

  // 使用 name 字段作为唯一标识（Prisma schema 要求）
  await prisma.agentConfig.upsert({
    where: { name: 'default' },
    update: {
      config: defaultConfig as unknown as Prisma.InputJsonValue,
      isDefault: true,
    },
    create: {
      name: 'default',
      config: defaultConfig as unknown as Prisma.InputJsonValue,
      isDefault: true,
    },
  });

  // 确保只有一个默认配置
  await prisma.agentConfig.updateMany({
    where: {
      name: { not: 'default' },
      isDefault: true,
    },
    data: { isDefault: false },
  });

  console.log('Agent config migrated successfully');
  console.log('Available tools:', defaultConfig.availableTools);
  console.log('useToolCalling:', defaultConfig.useToolCalling);
}

main()
  .then(() => {
    // 使用 exitCode 而非 exit() 让 finally 正常执行
    process.exitCode = 0;
  })
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
