import { describe, it, expect } from "vitest";
import { aggregateTags, type TagCountInput } from "./tag-aggregation";

describe("tag-aggregation", () => {
  it("aggregates semantically similar tags into one parent tag", () => {
    const input: TagCountInput[] = [
      { tag: "AI Agent", count: 3 },
      { tag: "Agent", count: 2 },
      { tag: "Agentic Workflow", count: 1 },
    ];

    const result = aggregateTags(input, { limit: 10, minCount: 1, semantic: true });

    expect(result[0].tag).toBe("Agent");
    expect(result[0].count).toBe(6);
    expect(result[0].filterTags).toEqual(
      expect.arrayContaining(["AI Agent", "Agent", "Agentic Workflow"])
    );
    expect(result[0].aliases.length).toBe(3);
  });

  it("supports top-N and min-count filtering", () => {
    const input: TagCountInput[] = [
      { tag: "A", count: 5 },
      { tag: "B", count: 4 },
      { tag: "C", count: 1 },
      { tag: "D", count: 3 },
      { tag: "E", count: 2 },
    ];

    const result = aggregateTags(input, { limit: 3, minCount: 2, semantic: false });

    expect(result).toHaveLength(3);
    expect(result.map((item) => item.count)).toEqual([5, 4, 3]);
    expect(result.find((item) => item.tag === "C")).toBeUndefined();
  });

  it("normalizes case and separators when grouping", () => {
    const input: TagCountInput[] = [
      { tag: "Prompt Engineering", count: 2 },
      { tag: "prompt-engineering", count: 1 },
      { tag: "Prompt engineering ", count: 1 },
    ];

    const result = aggregateTags(input, { limit: 10, minCount: 1, semantic: false });

    expect(result).toHaveLength(1);
    expect(result[0].count).toBe(4);
    expect(result[0].aliases.map((alias) => alias.tag)).toEqual(
      expect.arrayContaining(["Prompt Engineering", "prompt-engineering", "Prompt engineering"])
    );
  });

  it("supports multilingual semantic aggregation", () => {
    const input: TagCountInput[] = [
      { tag: "Reinforcement Learning", count: 2 },
      { tag: "强化学习", count: 1 },
    ];

    const result = aggregateTags(input, { limit: 10, minCount: 1, semantic: true });

    expect(result).toHaveLength(1);
    expect(result[0].tag).toBe("Reinforcement Learning");
    expect(result[0].count).toBe(3);
    expect(result[0].filterTags).toEqual(
      expect.arrayContaining(["Reinforcement Learning", "强化学习"])
    );
  });
});
