import { describe, expect, it } from 'vitest';
import { normalizeAgentIngestDecision } from './ingest-contract';

describe('normalizeAgentIngestDecision', () => {
  it('accepts strict enum payload and keeps practice task', () => {
    const normalized = normalizeAgentIngestDecision({
      contentType: 'CASE_STUDY',
      techDomain: 'RAG',
      aiTags: ['RAG', 'Security'],
      coreSummary: '核心总结',
      keyPoints: ['点1', '点2'],
      practiceValue: 'ACTIONABLE',
      practiceReason: '可落地',
      practiceTask: {
        title: '实践任务',
        summary: '总结',
        difficulty: 'HARD',
        estimatedTime: '2小时',
        prerequisites: ['Node.js'],
        steps: [
          { order: 1, title: '步骤1', description: '描述1' },
        ],
      },
    });

    expect(normalized).not.toBeNull();
    expect(normalized?.contentType).toBe('CASE_STUDY');
    expect(normalized?.practiceTask?.difficulty).toBe('HARD');
    expect(normalized?.practiceTask?.steps).toHaveLength(1);
  });

  it('maps loose values and infers missing defaults', () => {
    const normalized = normalizeAgentIngestDecision({
      contentType: 'tutorial',
      techDomain: 'prompt engineering',
      aiTags: ['Prompt', 'Prompt'],
      coreSummary: '这是总结',
      keyPoints: '要点A\n要点B',
      practiceValue: 'actionable',
      practiceTask: {
        title: 'Task A',
        summary: 'Summary A',
        difficulty: 'intermediate',
        estimatedTime: '45分钟',
        prerequisites: 'Python',
        steps: [
          { title: 'step-a', description: 'desc-a' },
          { order: 3, title: 'step-b', description: 'desc-b' },
        ],
      },
    });

    expect(normalized).not.toBeNull();
    expect(normalized?.contentType).toBe('TUTORIAL');
    expect(normalized?.techDomain).toBe('PROMPT_ENGINEERING');
    expect(normalized?.aiTags).toEqual(['Prompt']);
    expect(normalized?.practiceTask?.difficulty).toBe('MEDIUM');
    expect(normalized?.practiceTask?.prerequisites).toEqual(['Python']);
    expect(normalized?.practiceTask?.steps.map((s) => s.order)).toEqual([1, 3]);
  });

  it('returns null when required fields are missing', () => {
    const normalized = normalizeAgentIngestDecision({
      contentType: 'case_study',
      techDomain: 'rag',
      keyPoints: ['x'],
      practiceValue: 'knowledge',
    });

    expect(normalized).toBeNull();
  });

  it("normalizes dynamic summary fields from agent output", () => {
    const normalized = normalizeAgentIngestDecision({
      contentType: "TUTORIAL",
      techDomain: "AGENT",
      aiTags: ["Agent"],
      coreSummary: "核心总结",
      keyPoints: {
        core: ["核心点1", "核心点2"],
        extended: ["扩展点1"],
      },
      summaryStructure: {
        type: "problem-solution-steps",
        reasoning: "内容是步骤型教程",
        fields: {
          problem: "问题",
          solution: "方案",
          steps: [{ order: 1, title: "第一步" }],
        },
      },
      boundaries: {
        applicable: ["适用场景"],
        notApplicable: ["不适用场景"],
      },
      confidence: 0.88,
      difficulty: "MEDIUM",
      sourceTrust: "HIGH",
      timeliness: "RECENT",
      practiceValue: "ACTIONABLE",
      practiceReason: "可落地",
      practiceTask: {
        title: "实践任务",
        summary: "实践任务总结",
        difficulty: "MEDIUM",
        estimatedTime: "30分钟",
        prerequisites: [],
        steps: [{ order: 1, title: "执行", description: "描述" }],
      },
    });

    expect(normalized).not.toBeNull();
    expect(normalized).toHaveProperty("summaryStructure.type", "problem-solution-steps");
    expect(normalized).toHaveProperty("keyPointsNew.core", ["核心点1", "核心点2"]);
    expect(normalized).toHaveProperty("keyPointsNew.extended", ["扩展点1"]);
    expect(normalized).toHaveProperty("boundaries.applicable", ["适用场景"]);
    expect(normalized).toHaveProperty("boundaries.notApplicable", ["不适用场景"]);
    expect(normalized).toHaveProperty("confidence", 0.88);
  });

  it("builds keyPointsNew from legacy keyPoints array", () => {
    const normalized = normalizeAgentIngestDecision({
      contentType: "TECH_PRINCIPLE",
      techDomain: "RAG",
      aiTags: ["RAG"],
      coreSummary: "旧格式总结",
      keyPoints: ["点1", "点2"],
      practiceValue: "KNOWLEDGE",
      practiceReason: "了解即可",
      practiceTask: null,
    });

    expect(normalized).not.toBeNull();
    expect(normalized).toHaveProperty("keyPointsNew.core", ["点1", "点2"]);
    expect(normalized).toHaveProperty("keyPointsNew.extended", []);
    expect(normalized).toHaveProperty("summaryStructure.type", "generic");
  });

  it("densifies key points for long content using structured fields", () => {
    const normalized = normalizeAgentIngestDecision(
      {
        contentType: "CASE_STUDY",
        techDomain: "FINE_TUNING",
        aiTags: ["VLM"],
        coreSummary: "长文总结：覆盖了背景、路线、实验、落地和未来规划。",
        keyPoints: {
          core: ["核心点1", "核心点2", "核心点3"],
          extended: ["扩展点1"],
        },
        summaryStructure: {
          type: "background-result-insight",
          fields: {
            background: "背景：内容安全场景要求高召回与低误报。",
            route: "路线：自研视觉基座并结合多模态对齐。",
            data: "数据：业务数据与开源数据混合训练。",
            experiment: "实验：分辨率和蒸馏策略带来稳定增益。",
            impact: "落地：在直播和短视频风险识别上显著提升。",
          },
        },
        boundaries: {
          applicable: ["短视频审核", "直播审核"],
          notApplicable: ["纯音频原始建模"],
        },
        practiceValue: "ACTIONABLE",
        practiceReason: "具备复现实验路径与参数对照。",
        practiceTask: {
          title: "训练任务",
          summary: "构建垂类多模态基座",
          difficulty: "HARD",
          estimatedTime: "4周",
          prerequisites: ["GPU 集群"],
          steps: [
            { order: 1, title: "准备数据", description: "构建高质量图文对齐集" },
            { order: 2, title: "训练视觉基座", description: "引入蒸馏增强泛化能力" },
            { order: 3, title: "多任务训练", description: "注入 OCR 与风险识别任务" },
            { order: 4, title: "评估上线", description: "离线评估后灰度发布" },
          ],
        },
      },
      { contentLength: 35_000 }
    );

    expect(normalized).not.toBeNull();
    expect(normalized?.keyPointsNew.core.length).toBeGreaterThanOrEqual(8);
    expect(normalized?.keyPointsNew.extended.length).toBeGreaterThanOrEqual(4);
    expect(normalized?.keyPoints.length).toBeGreaterThanOrEqual(12);
  });
});
