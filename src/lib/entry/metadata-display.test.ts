import { describe, expect, it } from "vitest";
import { buildMetadataRows } from "./metadata-display";

describe("buildMetadataRows", () => {
  it("builds rows with value preview and derived confidence", () => {
    const rows = buildMetadataRows({
      coreSummary: "核心摘要",
      keyPoints: ["要点A", "要点B"],
      confidence: 0.95,
      hasPracticeTask: true,
    });

    const core = rows.find((row) => row.key === "coreSummary");
    const points = rows.find((row) => row.key === "keyPoints");
    const practice = rows.find((row) => row.key === "practiceTask");

    expect(core?.value).toContain("核心摘要");
    expect(core?.confidence).toBe("high");
    expect(points?.value).toContain("要点A");
    expect(practice?.value).toBe("Available");
  });

  it("keeps all key points without truncating to top 2", () => {
    const rows = buildMetadataRows({
      keyPoints: ["要点A", "要点B", "要点C"],
      confidence: 0.95,
    });

    const points = rows.find((row) => row.key === "keyPoints");
    expect(points?.value).toContain("要点A");
    expect(points?.value).toContain("要点B");
    expect(points?.value).toContain("要点C");
  });

  it("returns empty rows when there is no extracted content", () => {
    const rows = buildMetadataRows({
      coreSummary: null,
      keyPoints: null,
      boundaries: null,
      summaryStructure: null,
      confidence: null,
      hasPracticeTask: false,
      hasRelatedEntries: false,
    });

    expect(rows).toEqual([]);
  });
});
