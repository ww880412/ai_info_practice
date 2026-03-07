import { describe, expect, it } from "vitest";
import { formatEntryDateTime } from "./format-datetime";

describe("formatEntryDateTime", () => {
  it("formats ISO timestamps with a stable UTC display", () => {
    expect(formatEntryDateTime("2026-03-07T12:24:15.980Z")).toBe("2026-03-07 12:24 UTC");
  });

  it("returns a fallback for invalid values", () => {
    expect(formatEntryDateTime("not-a-date")).toBe("-");
  });
});
