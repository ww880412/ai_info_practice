import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from "@prisma/client";
import { prisma } from '@/lib/prisma';

// 质量评估维度
interface QualityDimensions {
  sourceTrust: { value: string; label: string };
  timeliness: { value: string; label: string };
  completeness: { value: number; label: string };
  contentForm: { value: string; label: string };
  difficulty: { value: string; label: string };
}

// 从 Entry 字段构建 AI 评估
function buildAIAssessment(entry: {
  sourceTrust?: string | null;
  timeliness?: string | null;
  difficulty?: string | null;
  contentForm?: string | null;
  confidence?: number | null;
}): { dimensions: QualityDimensions; confidence: number } {
  const dimensionLabels: Record<string, string> = {
    HIGH: '高', MEDIUM: '中', LOW: '低',
    RECENT: '近期', OUTDATED: '过时', CLASSIC: '经典',
    EASY: '简单', HARD: '困难',
    TEXTUAL: '文本', CODE_HEAVY: '代码', VISUAL: '视觉', MULTIMODAL: '多模态',
  };

  const dimensions: QualityDimensions = {
    sourceTrust: {
      value: entry.sourceTrust || 'MEDIUM',
      label: dimensionLabels[entry.sourceTrust || 'MEDIUM'] || '中',
    },
    timeliness: {
      value: entry.timeliness || 'RECENT',
      label: dimensionLabels[entry.timeliness || 'RECENT'] || '近期',
    },
    completeness: {
      value: entry.confidence || 0.5,
      label: `${Math.round((entry.confidence || 0.5) * 100)}%`,
    },
    contentForm: {
      value: entry.contentForm || 'TEXTUAL',
      label: dimensionLabels[entry.contentForm || 'TEXTUAL'] || '文本',
    },
    difficulty: {
      value: entry.difficulty || 'MEDIUM',
      label: dimensionLabels[entry.difficulty || 'MEDIUM'] || '中等',
    },
  };

  // 综合置信度 = 各维度加权平均
  const trustScore = { HIGH: 1, MEDIUM: 0.6, LOW: 0.3 }[entry.sourceTrust || 'MEDIUM'] || 0.6;
  const timeScore = { RECENT: 1, CLASSIC: 0.8, OUTDATED: 0.4 }[entry.timeliness || 'RECENT'] || 0.8;
  const confScore = entry.confidence || 0.5;
  const confidence = (trustScore * 0.3 + timeScore * 0.2 + confScore * 0.5);

  return { dimensions, confidence };
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  try {
    const entry = await prisma.entry.findUnique({
      where: { id },
      select: {
        sourceTrust: true,
        timeliness: true,
        difficulty: true,
        contentForm: true,
        confidence: true,
        qualityOverride: true,
        qualityHistories: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!entry) {
      return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
    }

    // AI 评估（从 Entry 字段）
    const aiAssessment = buildAIAssessment(entry);

    // 用户覆盖
    const override = entry.qualityOverride as Record<string, unknown> | null;

    // 合并 AI 评估和用户覆盖
    const dimensions = override
      ? { ...aiAssessment.dimensions, ...override }
      : aiAssessment.dimensions;

    // 历史记录
    const history = entry.qualityHistories.map(h => ({
      id: h.id,
      changedAt: h.createdAt.toISOString(),
      changes: [
        `modified: ${Object.keys(h.newJson as object).join(', ')}`,
      ],
    }));

    return NextResponse.json({
      data: {
        dimensions,
        confidence: aiAssessment.confidence,
        confidenceDisplay: `${Math.round(aiAssessment.confidence * 100)}%`,
        override,
        history,
      },
    });
  } catch (error) {
    console.error('Error fetching quality:', error);
    return NextResponse.json({ error: 'Failed to fetch quality' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  try {
    const body = await request.json();
    const { override, reason } = body as {
      override: Record<string, unknown>;
      reason?: string;
    };

    // 获取当前评估
    const entry = await prisma.entry.findUnique({
      where: { id },
      select: { qualityOverride: true },
    });

    if (!entry) {
      return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
    }

    const previousJson = (entry.qualityOverride || {}) as Prisma.InputJsonValue;

    // 创建历史记录
    await prisma.qualityRevision.create({
      data: {
        entryId: id,
        previousJson,
        newJson: override as Prisma.InputJsonValue,
        overrideReason: reason,
      },
    });

    // 更新覆盖值
    const updated = await prisma.entry.update({
      where: { id },
      data: { qualityOverride: override as Prisma.InputJsonValue },
    });

    return NextResponse.json({ data: { success: true, qualityOverride: updated.qualityOverride } });
  } catch (error) {
    console.error('Error updating quality:', error);
    return NextResponse.json({ error: 'Failed to update quality' }, { status: 500 });
  }
}
