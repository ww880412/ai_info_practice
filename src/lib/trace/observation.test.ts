import { describe, expect, it } from "vitest";
import { parseObservation, stringifyObservation } from "./observation";

describe("observation utilities", () => {
  it("stringifyObservation keeps full payload without truncation", () => {
    const payload = {
      longText: "x".repeat(2200),
      nested: { level: 1, ok: true },
    };

    const serialized = stringifyObservation(payload);
    expect(serialized.length).toBeGreaterThan(2000);
    expect(serialized.includes("...")).toBe(false);
  });

  it("parseObservation parses valid JSON string", () => {
    const parsed = parseObservation('{"a":1,"b":[2,3]}');
    expect(parsed).toEqual({ a: 1, b: [2, 3] });
  });

  it("parseObservation returns raw text for invalid JSON", () => {
    const raw = "not-json";
    expect(parseObservation(raw)).toBe(raw);
  });
});
