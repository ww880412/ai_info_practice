import { describe, expect, it } from "vitest";
import { parseBulkDeleteIds } from "./bulk-delete";

describe("parseBulkDeleteIds", () => {
  it("returns deduplicated non-empty ids", () => {
    const ids = parseBulkDeleteIds({
      ids: ["a", "b", "a", " ", "", "c"],
    });

    expect(ids).toEqual(["a", "b", "c"]);
  });

  it("returns empty array when payload is invalid", () => {
    expect(parseBulkDeleteIds(null)).toEqual([]);
    expect(parseBulkDeleteIds({})).toEqual([]);
    expect(parseBulkDeleteIds({ ids: "a" })).toEqual([]);
  });
});
