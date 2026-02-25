import { describe, expect, it } from "vitest";
import { getGroupImportState } from "./group-import";

describe("getGroupImportState", () => {
  it("disables import when no entries are selected", () => {
    expect(getGroupImportState("group-1", 0)).toEqual({
      canImport: false,
      reason: "Select entries first",
    });
  });

  it("disables import when no group is selected", () => {
    expect(getGroupImportState(null, 3)).toEqual({
      canImport: false,
      reason: "Choose target group",
    });
  });

  it("allows import when both selected entries and group exist", () => {
    expect(getGroupImportState("group-1", 2)).toEqual({
      canImport: true,
      reason: "",
    });
  });
});
