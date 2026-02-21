import { NextRequest, NextResponse } from 'next/server';
import { getDefaultConfig } from '@/lib/ai/agent/config';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const saved = await prisma.agentConfig.findFirst({
    where: { isDefault: true },
  });

  return NextResponse.json({
    config: saved ? saved.config : getDefaultConfig(),
  });
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();

    const config = await prisma.agentConfig.upsert({
      where: { id: body.id || 'default' },
      update: { config: body.config },
      create: {
        id: 'default',
        name: 'default',
        config: body.config,
        isDefault: true,
      },
    });

    return NextResponse.json({ success: true, config: config.config });
  } catch (error) {
    console.error('Error saving config:', error);
    return NextResponse.json(
      { error: 'Failed to save config' },
      { status: 500 }
    );
  }
}

export async function POST() {
  // 重置为默认
  await prisma.agentConfig.deleteMany({
    where: { isDefault: true },
  });

  return NextResponse.json({ success: true, config: getDefaultConfig() });
}
