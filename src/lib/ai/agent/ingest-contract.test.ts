import { describe, expect, it } from 'vitest';
import {
  calculateDecisionEnglishRatio,
  evaluateDecisionQuality,
  isDecisionMostlyChinese,
  isDecisionStructurallyComplete,
  normalizeAgentIngestDecision,
} from './ingest-contract';

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

  it("detects mostly-English decision text", () => {
    const normalized = normalizeAgentIngestDecision({
      contentType: "CASE_STUDY",
      techDomain: "AGENT",
      aiTags: ["Agent"],
      coreSummary: "This article introduces a lightweight model architecture for safety governance.",
      keyPoints: {
        core: [
          "Tiered architecture improves throughput in high concurrency scenarios.",
          "Domain fine-tuning can outperform larger general-purpose models.",
        ],
        extended: [
          "Token compression and vLLM scheduling are key acceleration techniques.",
        ],
      },
      summaryStructure: {
        type: "problem-solution-steps",
        reasoning: "The paper follows a classic problem-solution structure.",
        fields: {
          problem: "High inference cost and latency in large-scale moderation.",
          solution: "Use compact models and inference optimization strategies.",
        },
      },
      boundaries: {
        applicable: ["High-concurrency safety filtering"],
        notApplicable: ["Creative long-form writing generation"],
      },
      practiceValue: "KNOWLEDGE",
      practiceReason: "The content is useful for architecture understanding.",
      practiceTask: null,
    });

    expect(normalized).not.toBeNull();
    expect(calculateDecisionEnglishRatio(normalized!)).toBeGreaterThan(0.6);
    expect(isDecisionMostlyChinese(normalized!)).toBe(false);
  });

  it("allows Chinese output with technical terms", () => {
    const normalized = normalizeAgentIngestDecision({
      contentType: "TECH_PRINCIPLE",
      techDomain: "RAG",
      aiTags: ["RAG", "LLM"],
      coreSummary: "本文介绍了 RAG 在内容安全场景中的落地方式，并对 API 调用链路进行优化。",
      keyPoints: {
        core: [
          "通过 RAG + Agent 提升长尾风险场景召回率。",
          "结合 vLLM 与 Token 压缩降低推理成本。",
        ],
        extended: [
          "保持 JSON 输出结构稳定，便于下游解析。",
        ],
      },
      summaryStructure: {
        type: "concept-mechanism-flow",
        reasoning: "先解释原理，再给出机制与流程。",
        fields: {
          concept: "知识检索增强生成",
          mechanism: "向量召回 + 重排 + 生成",
          flow: "召回候选 -> 风险判定 -> 输出建议",
        },
      },
      boundaries: {
        applicable: ["复杂政策问答", "多轮审核辅助"],
        notApplicable: ["纯离线批处理统计"],
      },
      practiceValue: "ACTIONABLE",
      practiceReason: "可直接复用到现有审核流水线中。",
      practiceTask: {
        title: "搭建 RAG 审核助手",
        summary: "实现检索与判定闭环",
        difficulty: "MEDIUM",
        estimatedTime: "2 天",
        prerequisites: ["向量数据库", "服务化部署环境"],
        steps: [{ order: 1, title: "接入检索", description: "配置召回与重排策略" }],
      },
    });

    expect(normalized).not.toBeNull();
    expect(calculateDecisionEnglishRatio(normalized!)).toBeLessThan(0.35);
    expect(isDecisionMostlyChinese(normalized!)).toBe(true);
  });

  it("marks sparse decision as structurally incomplete", () => {
    const normalized = normalizeAgentIngestDecision({
      contentType: "TUTORIAL",
      techDomain: "AGENT",
      aiTags: ["Agent"],
      coreSummary: "简短总结",
      keyPoints: {
        core: ["点1"],
        extended: [],
      },
      summaryStructure: {
        type: "generic",
        fields: { summary: "只有一个字段" },
      },
      boundaries: {
        applicable: [],
        notApplicable: [],
      },
      practiceValue: "ACTIONABLE",
      practiceReason: "可实践",
      practiceTask: {
        title: "任务",
        summary: "总结",
        difficulty: "MEDIUM",
        estimatedTime: "30分钟",
        prerequisites: [],
        steps: [{ order: 1, title: "一步", description: "描述" }],
      },
    });

    expect(normalized).not.toBeNull();
    const report = evaluateDecisionQuality(normalized!, { contentLength: 20000 });
    expect(report.score).toBeLessThan(0.72);
    expect(report.issues.length).toBeGreaterThan(0);
    expect(isDecisionStructurallyComplete(normalized!, { contentLength: 20000 })).toBe(false);
  });

  it("marks rich decision as structurally complete", () => {
    const normalized = normalizeAgentIngestDecision({
      contentType: "CASE_STUDY",
      techDomain: "FINE_TUNING",
      aiTags: ["RAG", "Agent"],
      coreSummary:
        "本文系统梳理了轻量化安全大模型方案，包括分层架构、推理优化和训练迭代路径，并给出可落地的工程实践建议。",
      keyPoints: {
        core: ["核心1", "核心2", "核心3", "核心4", "核心5", "核心6", "核心7", "核心8"],
        extended: ["扩展1", "扩展2", "扩展3", "扩展4"],
      },
      summaryStructure: {
        type: "problem-solution-steps",
        reasoning: "先定义问题，再拆解方案与步骤。",
        fields: {
          problem: "高并发下推理成本高",
          solution: "轻量化模型 + 推理优化",
          steps: ["模型选型", "训练增强", "线上验证"],
        },
      },
      boundaries: {
        applicable: ["大规模内容审核", "高并发推理场景"],
        notApplicable: ["纯创作型生成任务"],
      },
      practiceValue: "ACTIONABLE",
      practiceReason: "包含可执行步骤和参数范围。",
      practiceTask: {
        title: "搭建轻量审核流水线",
        summary: "分阶段完成模型与推理优化",
        difficulty: "HARD",
        estimatedTime: "2周",
        prerequisites: ["GPU 集群", "线上监控体系"],
        steps: [
          { order: 1, title: "准备数据", description: "完成样本构建与清洗" },
          { order: 2, title: "训练模型", description: "完成 SFT 与对比实验" },
          { order: 3, title: "推理优化", description: "接入压缩与调度优化" },
        ],
      },
    });

    expect(normalized).not.toBeNull();
    const report = evaluateDecisionQuality(normalized!, { contentLength: 30000 });
    expect(report.score).toBeGreaterThanOrEqual(0.72);
    expect(isDecisionStructurallyComplete(normalized!, { contentLength: 30000 })).toBe(true);
  });
});
