import { describe, expect, it } from "vitest";

import { getDefaultConfig } from "./config";
import { createToolCallingTools, createToolExecutionContext } from "./sdk-tools";

describe("createToolCallingTools", () => {
  it("exposes only the tools needed for final ingest output", () => {
    const ctx = createToolExecutionContext(
      "entry-1",
      {
        title: "Test",
        content: "Tool calling content",
        sourceType: "WEBPAGE",
      },
      getDefaultConfig()
    );

    const tools = createToolCallingTools(ctx);

    expect(Object.keys(tools)).toEqual([
      "classify_content",
      "extract_summary",
      "extract_code",
      "extract_version",
    ]);
  });
});
