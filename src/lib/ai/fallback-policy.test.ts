import { describe, expect, it } from "vitest";
import { isLegacyClassifierFallbackEnabled } from "./fallback-policy";

describe("isLegacyClassifierFallbackEnabled", () => {
  it("defaults to enabled when env is unset", () => {
    expect(isLegacyClassifierFallbackEnabled(undefined)).toBe(true);
  });

  it("disables fallback only when env is explicit false", () => {
    expect(isLegacyClassifierFallbackEnabled("false")).toBe(false);
    expect(isLegacyClassifierFallbackEnabled("FALSE")).toBe(false);
  });

  it("keeps fallback enabled for true and other values", () => {
    expect(isLegacyClassifierFallbackEnabled("true")).toBe(true);
    expect(isLegacyClassifierFallbackEnabled("1")).toBe(true);
  });
});
