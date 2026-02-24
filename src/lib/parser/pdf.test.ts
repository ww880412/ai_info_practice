import { describe, expect, it } from "vitest";
import { __internal } from "./pdf";

describe("pdf parser internals", () => {
  it("chooses higher page budget for larger PDFs", () => {
    expect(__internal.getDefaultMaxPdfPages(5 * 1024 * 1024)).toBe(8);
    expect(__internal.getDefaultMaxPdfPages(12 * 1024 * 1024)).toBe(12);
    expect(__internal.getDefaultMaxPdfPages(25 * 1024 * 1024)).toBe(16);
  });

  it("builds page-aware content output", () => {
    const content = __internal.buildPdfContentFromPages([
      { page: 1, title: "A", content: "first page" },
      { page: 3, title: "B", content: "third page" },
    ]);

    expect(content).toContain("[Page 1]");
    expect(content).toContain("first page");
    expect(content).toContain("[Page 3]");
    expect(content).toContain("third page");
  });

  it("enables direct fallback when Poppler binary is missing", () => {
    const error = new Error("pdftoppm failed: spawn pdftoppm ENOENT");
    expect(__internal.shouldFallbackToDirectPdfParsing(error, false)).toBe(true);
  });

  it("keeps direct fallback disabled for non-missing-binary errors by default", () => {
    const error = new Error("PDF page extraction failed: empty content");
    expect(__internal.shouldFallbackToDirectPdfParsing(error, false)).toBe(false);
  });
});
