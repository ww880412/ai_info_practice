import { describe, expect, it } from "vitest";

import { normalizeSummaryStructureForPersistence } from "./summary-structure";

describe("normalizeSummaryStructureForPersistence", () => {
  it("preserves stage-based timeline evolution fields", () => {
    const normalized = normalizeSummaryStructureForPersistence(
      {
        type: "timeline-evolution",
        reasoning: "按阶段展示更合适。",
        fields: {
          events: [
            {
              stage: "征询能力设计",
              initialApproach: "先尝试复用 ExitPlanTool。",
              problem: "计划与提问耦合。",
              finalChoice: "改成专门的提问工具。",
            },
          ],
          currentStatus: "当前方案更强调结构化提问。",
        },
      },
      {
        coreSummary: "总结",
        keyPoints: ["要点一"],
      }
    );

    expect(normalized.type).toBe("timeline-evolution");
    expect(normalized.fields).toEqual({
      events: [
        {
          stage: "征询能力设计",
          initialApproach: "先尝试复用 ExitPlanTool。",
          problem: "计划与提问耦合。",
          finalChoice: "改成专门的提问工具。",
        },
      ],
      currentStatus: "当前方案更强调结构化提问。",
    });
  });

  it("preserves string-array timeline evolution fields", () => {
    const normalized = normalizeSummaryStructureForPersistence(
      {
        type: "timeline-evolution",
        fields: {
          events: ["先试图复用 ExitPlanTool", "后续改用 AskUserQuestion"],
          stages: ["征询能力演进到结构化提问"],
          outcome: "形成新的设计哲学",
          insight: "新增工具要控制模型认知负担",
        },
      },
      {
        coreSummary: "总结",
        keyPoints: ["要点一"],
      }
    );

    expect(normalized.type).toBe("timeline-evolution");
    expect(normalized.fields).toEqual({
      events: ["先试图复用 ExitPlanTool", "后续改用 AskUserQuestion"],
      stages: ["征询能力演进到结构化提问"],
      outcome: "形成新的设计哲学",
      insight: "新增工具要控制模型认知负担",
    });
  });

  it("downgrades invalid structures to generic fallback", () => {
    const normalized = normalizeSummaryStructureForPersistence(
      {
        type: "timeline-evolution",
        fields: {
          events: [123, true],
        },
      },
      {
        coreSummary: "总结",
        keyPoints: ["要点一", "要点二"],
      }
    );

    expect(normalized).toEqual({
      type: "generic",
      fields: {
        summary: "总结",
        keyPoints: ["要点一", "要点二"],
      },
    });
  });
});
