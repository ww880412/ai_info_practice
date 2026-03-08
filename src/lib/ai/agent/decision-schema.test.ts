import { describe, expect, it } from "vitest";

import { DecisionSchema, ToolCallingDecisionSchema } from "./decision-schema";

describe("ToolCallingDecisionSchema", () => {
  it("accepts nested tool-calling output that strict DecisionSchema rejects", () => {
    const payload = {
      contentType: "CASE_STUDY",
      techDomain: "AGENT",
      strategy: "RESEARCH",
      title: "从构建Claude Code中汲取的教训",
      source: "WECHAT",
      decision: {
        shouldSave: false,
        reason: "库中已有重复条目，无需重复入库。",
      },
      summary: {
        coreSummary: "总结",
        keyPoints: ["核心洞察", "补充洞察"],
        structure: "timeline-evolution",
        practiceValue: "KNOWLEDGE",
        difficulty: "MEDIUM",
        timeliness: "RECENT",
        sourceTrust: "MEDIUM",
      },
      tags: ["Agent", "工具调用"],
    };

    expect(DecisionSchema.safeParse(payload).success).toBe(false);
    expect(ToolCallingDecisionSchema.safeParse(payload).success).toBe(true);
  });

  it("accepts partially shaped tool-calling output for post-normalization", () => {
    const payload = {
      contentType: "CASE_STUDY",
      techDomain: "AGENT",
      aiTags: ["Agent"],
      coreSummary: "总结",
      keyPoints: {
        core: ["核心洞察"],
      },
      summaryStructure: {
        type: "timeline-evolution",
        fields: {
          events: ["事件一", "事件二"],
          stages: ["阶段一"],
          outcome: "形成新的设计哲学",
          insight: "工具设计必须与模型能力匹配",
        },
      },
      boundaries: {
        applicable: ["适用于 Agent"],
      },
      practiceValue: "KNOWLEDGE",
      practiceReason: "经验总结",
    };

    expect(ToolCallingDecisionSchema.safeParse(payload).success).toBe(true);
  });
});
