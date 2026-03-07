import { afterEach, describe, expect, it, vi } from "vitest";

import { createCRSLanguageModel } from "./crs";

const originalFetch = globalThis.fetch;

function createSSEBody(events: unknown[]) {
  const payload = events
    .map((event) => `event: ${String((event as { type?: string }).type)}\ndata: ${JSON.stringify(event)}\n`)
    .join("\n");

  return new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(payload));
      controller.close();
    },
  });
}

describe("CRS provider tool calling", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("passes tools to the Responses API request", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      return new Response(createSSEBody([
        {
          type: "response.created",
          response: { id: "resp_1", model: "gpt-5.4", created_at: 1772891365, status: "in_progress" },
        },
        {
          type: "response.completed",
          response: {
            id: "resp_1",
            model: "gpt-5.4",
            created_at: 1772891365,
            status: "completed",
            usage: { input_tokens: 1, output_tokens: 1 },
          },
        },
      ]), {
        status: 200,
        headers: { "content-type": "text/event-stream" },
      });
    });
    globalThis.fetch = fetchMock as typeof fetch;

    const model = createCRSLanguageModel({
      enabled: true,
      baseUrl: "https://ls.xingchentech.asia/openai",
      apiKey: "test-key",
      model: "gpt-5.4",
    });

    await model.doGenerate({
      prompt: [
        {
          role: "user",
          content: [{ type: "text", text: "Call the tool." }],
        },
      ],
      tools: [
        {
          type: "function",
          name: "echo_json",
          description: "Echo input",
          inputSchema: {
            type: "object",
            properties: {
              value: { type: "string" },
            },
            required: ["value"],
            additionalProperties: false,
          },
        },
      ],
      toolChoice: { type: "auto" },
    } as never);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(String(init?.body));

    expect(body.tools).toEqual([
      {
        type: "function",
        name: "echo_json",
        description: "Echo input",
        parameters: {
          type: "object",
          properties: {
            value: { type: "string" },
          },
          required: ["value"],
          additionalProperties: false,
        },
      },
    ]);
    expect(body.tool_choice).toBe("auto");
  });

  it("maps function_call stream events to AI SDK tool-call content", async () => {
    globalThis.fetch = vi.fn(async () => {
      return new Response(createSSEBody([
        {
          type: "response.created",
          response: { id: "resp_1", model: "gpt-5.4", created_at: 1772891365, status: "in_progress" },
        },
        {
          type: "response.output_item.done",
          item: {
            id: "fc_1",
            type: "function_call",
            status: "completed",
            arguments: "{\"value\":\"hello\"}",
            call_id: "call_1",
            name: "echo_json",
          },
        },
        {
          type: "response.completed",
          response: {
            id: "resp_1",
            model: "gpt-5.4",
            created_at: 1772891365,
            status: "completed",
            usage: { input_tokens: 1, output_tokens: 1 },
          },
        },
      ]), {
        status: 200,
        headers: { "content-type": "text/event-stream" },
      });
    }) as typeof fetch;

    const model = createCRSLanguageModel({
      enabled: true,
      baseUrl: "https://ls.xingchentech.asia/openai",
      apiKey: "test-key",
      model: "gpt-5.4",
    });

    const result = await model.doGenerate({
      prompt: [
        {
          role: "user",
          content: [{ type: "text", text: "Call the tool." }],
        },
      ],
      tools: [
        {
          type: "function",
          name: "echo_json",
          inputSchema: {
            type: "object",
            properties: {
              value: { type: "string" },
            },
            required: ["value"],
          },
        },
      ],
      toolChoice: { type: "auto" },
    } as never);

    expect(result.content).toContainEqual({
      type: "tool-call",
      toolCallId: "call_1",
      toolName: "echo_json",
      input: "{\"value\":\"hello\"}",
    });
  });
});
