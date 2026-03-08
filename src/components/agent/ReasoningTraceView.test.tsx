import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { ReasoningTraceView } from "./ReasoningTraceView";

describe("ReasoningTraceView", () => {
  it("renders execution metadata for fallback traces", () => {
    const html = renderToStaticMarkup(
      <ReasoningTraceView
        steps={[
          {
            step: 1,
            thought: "分析内容结构",
            action: "ANALYZE_STRUCTURE",
            observation: "{}",
            reasoning: "执行第一步分析",
          },
        ]}
        metadata={{
          executionIntent: "tool_calling",
          executionMode: "two_step",
          twoStepReason: "fallback_after_tool_error",
          fallback: {
            triggered: true,
            fromMode: "tool_calling",
            reason: "tool_calling_error",
            errorName: "AI_NoObjectGeneratedError",
            errorMessage: "No object generated: response did not match schema.",
          },
          toolCallStats: {
            total: 0,
            success: 0,
            failed: 0,
            byTool: {},
          },
        }}
      />
    );

    expect(html).toContain("Tool Calling");
    expect(html).toContain("Two Step");
    expect(html).toContain("fallback_after_tool_error");
    expect(html).toContain("AI_NoObjectGeneratedError");
    expect(html).toContain("0 / 0 / 0");
  });
});
