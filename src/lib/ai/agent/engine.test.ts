import { describe, expect, it } from "vitest";
import { parseAgentResponse } from "./engine";

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
