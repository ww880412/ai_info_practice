import { describe, expect, it } from "vitest";
import { normalizeServerConfig, shouldRecreateClient } from "./gemini";

describe("normalizeServerConfig", () => {
  it("maps gemini-prefixed keys to normalized shape", () => {
    expect(
      normalizeServerConfig({
        geminiApiKey: "k-1",
        geminiModel: "gemini-3-flash-preview",
      })
    ).toEqual({
      apiKey: "k-1",
      model: "gemini-3-flash-preview",
    });
  });

  it("keeps explicit apiKey/model fields", () => {
    expect(
      normalizeServerConfig({
        apiKey: "k-2",
        model: "gemini-2.5-flash",
      })
    ).toEqual({
      apiKey: "k-2",
      model: "gemini-2.5-flash",
    });
  });
});

describe("shouldRecreateClient", () => {
  it("recreates when there is no existing client", () => {
    expect(
      shouldRecreateClient({
        hasClient: false,
        currentApiKey: "",
        nextApiKey: "abc",
      })
    ).toBe(true);
  });

  it("recreates when api key changes", () => {
    expect(
      shouldRecreateClient({
        hasClient: true,
        currentApiKey: "old",
        nextApiKey: "new",
      })
    ).toBe(true);
  });

  it("reuses when api key is unchanged and client exists", () => {
    expect(
      shouldRecreateClient({
        hasClient: true,
        currentApiKey: "same",
        nextApiKey: "same",
      })
    ).toBe(false);
  });
});
