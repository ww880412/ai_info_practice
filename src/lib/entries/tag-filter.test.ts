import { describe, expect, it } from "vitest";
import {
  buildCombinedTagFilterCondition,
  buildTagCategoryCondition,
  normalizeTagList,
} from "./tag-filter";

describe("tag-filter", () => {
  it("normalizes and deduplicates comma-separated tag lists", () => {
    expect(normalizeTagList(" RAG,Agent,,RAG , ")).toEqual(["RAG", "Agent"]);
    expect(normalizeTagList(null)).toEqual([]);
  });

  it("builds single category condition with hasSome", () => {
    const condition = buildTagCategoryCondition("aiTags", [], ["RAG"]);

    expect(condition).toEqual({
      aiTags: {
        hasSome: ["RAG"],
      },
    });
  });

  it("builds single category condition with hasEvery and hasSome", () => {
    const condition = buildTagCategoryCondition("aiTags", ["Agent"], ["RAG"]);

    expect(condition).toEqual({
      aiTags: {
        hasEvery: ["Agent"],
        hasSome: ["RAG"],
      },
    });
  });

  it("combines ai and user tag filters with OR", () => {
    const condition = buildCombinedTagFilterCondition({
      aiAll: [],
      aiAny: ["RAG"],
      userAll: [],
      userAny: ["重点"],
    });

    expect(condition).toEqual({
      OR: [
        { aiTags: { hasSome: ["RAG"] } },
        { userTags: { hasSome: ["重点"] } },
      ],
    });
  });
});
