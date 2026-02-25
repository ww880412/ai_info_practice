import { describe, expect, it } from "vitest";
import { flattenGroupOptions, type GroupTreeNode } from "./group-options";

describe("flattenGroupOptions", () => {
  it("flattens tree into selectable options with depth-aware labels", () => {
    const input: GroupTreeNode[] = [
      {
        id: "g1",
        name: "Agent",
        children: [
          { id: "g1-1", name: "RAG", children: [] },
        ],
      },
      {
        id: "g2",
        name: "Prompt",
        children: [],
      },
    ];

    expect(flattenGroupOptions(input)).toEqual([
      { id: "g1", label: "Agent" },
      { id: "g1-1", label: "Agent / RAG" },
      { id: "g2", label: "Prompt" },
    ]);
  });

  it("returns empty array for empty input", () => {
    expect(flattenGroupOptions([])).toEqual([]);
  });
});
