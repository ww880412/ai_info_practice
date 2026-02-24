import { describe, expect, it } from "vitest";
import { TextStrategy } from "./text";
import type { ParseInput } from "./strategy";

describe("TextStrategy", () => {
  it("only handles TEXT typed inputs", () => {
    const strategy = new TextStrategy();

    const textInput: ParseInput = {
      type: "TEXT",
      data: "plain text",
      size: 10,
    };

    const webpageInput: ParseInput = {
      type: "WEBPAGE",
      data: "https://example.com",
      size: 19,
    };

    expect(strategy.canHandle(textInput)).toBe(true);
    expect(strategy.canHandle(webpageInput)).toBe(false);
  });
});
