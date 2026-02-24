import { describe, expect, it } from "vitest";
import {
  buildContentSnapshot,
  mergeTwoStepResults,
  parseAgentResponse,
} from "./engine";

describe("parseAgentResponse", () => {
  it("parses action params and FINAL json in one response", () => {
    const response = `THINK: analyze content
ACTION: evaluate_dimension {"dimensionId":"source"}
REASONING: evaluate trust first
FINAL: {"contentType":"CASE_STUDY","aiTags":["RAG"]}`;

    const parsed = parseAgentResponse(response);

    expect(parsed.action.action).toBe("evaluate_dimension");
    expect(parsed.action.params).toEqual({ dimensionId: "source" });
    expect(parsed.final).toEqual({
      contentType: "CASE_STUDY",
      aiTags: ["RAG"],
    });
  });

  it("falls back to null final when FINAL is missing", () => {
    const response = `THINK: analyze content
ACTION: classify_content {"content":"hello"}
REASONING: classify first`;

    const parsed = parseAgentResponse(response);

    expect(parsed.action.action).toBe("classify_content");
    expect(parsed.final).toBeNull();
  });
});

describe("mergeTwoStepResults", () => {
  it("keeps step1 structure fields while merging step2 business output", () => {
    const merged = mergeTwoStepResults(
      {
        contentType: "TUTORIAL",
        techDomain: "AGENT",
        aiTags: ["A", "B"],
        summaryStructure: { type: "concept-mechanism-flow", fields: {} },
        keyPoints: { core: ["c1"], extended: ["e1"] },
        boundaries: { applicable: ["s1"], notApplicable: [] },
        confidence: 0.88,
      },
      {
        coreSummary: "summary",
        practiceValue: "ACTIONABLE",
        practiceReason: "reason",
        aiTags: ["B", "C"],
      }
    );

    expect(merged.contentType).toBe("TUTORIAL");
    expect(merged.techDomain).toBe("AGENT");
    expect(merged.summaryStructure).toEqual({
      type: "concept-mechanism-flow",
      fields: {},
    });
    expect(merged.keyPoints).toEqual({ core: ["c1"], extended: ["e1"] });
    expect(merged.boundaries).toEqual({ applicable: ["s1"], notApplicable: [] });
    expect(merged.aiTags).toEqual(["A", "B", "C"]);
    expect(merged.coreSummary).toBe("summary");
  });
});

describe("buildContentSnapshot", () => {
  it("returns full content when content is short", () => {
    const content = "short content";
    expect(buildContentSnapshot(content, 50)).toBe(content);
  });

  it("includes head/middle/tail markers for long content", () => {
    const content = "x".repeat(500) + "MIDDLE" + "y".repeat(500) + "TAIL";
    const snapshot = buildContentSnapshot(content, 300);

    expect(snapshot).toContain("[Head]");
    expect(snapshot).toContain("[Middle]");
    expect(snapshot).toContain("[Tail]");
    expect(snapshot).toContain("original length=");
  });
});
