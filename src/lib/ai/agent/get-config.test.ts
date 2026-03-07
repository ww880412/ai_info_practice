import { afterEach, describe, expect, it } from "vitest";

import { readUseToolCallingFromEnv } from "./get-config";

const originalUseCRSProvider = process.env.USE_CRS_PROVIDER;
const originalReactAgentUseTools = process.env.REACT_AGENT_USE_TOOLS;

describe("readUseToolCallingFromEnv", () => {
  afterEach(() => {
    process.env.USE_CRS_PROVIDER = originalUseCRSProvider;
    process.env.REACT_AGENT_USE_TOOLS = originalReactAgentUseTools;
  });

  it("keeps tool calling enabled for CRS unless explicitly disabled", () => {
    process.env.USE_CRS_PROVIDER = "true";
    delete process.env.REACT_AGENT_USE_TOOLS;

    expect(readUseToolCallingFromEnv()).toBe(true);
  });

  it("respects explicit REACT_AGENT_USE_TOOLS=false", () => {
    process.env.USE_CRS_PROVIDER = "true";
    process.env.REACT_AGENT_USE_TOOLS = "false";

    expect(readUseToolCallingFromEnv()).toBe(false);
  });
});
