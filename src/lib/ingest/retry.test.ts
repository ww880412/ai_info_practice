import { describe, expect, it, vi } from "vitest";
import {
  isRetriableAgentError,
  isRetriableIngestError,
  isRetriableParseError,
  runWithProgressRetry,
} from "./retry";

describe("isRetriableIngestError", () => {
  it("treats timeout/network style errors as retriable", () => {
    expect(isRetriableIngestError(new Error("pdf timed out after 180000ms"))).toBe(true);
    expect(isRetriableIngestError(new Error("fetch failed"))).toBe(true);
    expect(isRetriableIngestError(new Error("500 internal"))).toBe(true);
  });

  it("treats deterministic validation errors as non-retriable", () => {
    expect(isRetriableIngestError(new Error("invalid api key format"))).toBe(false);
  });
});

describe("stage-specific retry classifiers", () => {
  it("treats parser timeout/quality signals as retriable", () => {
    expect(isRetriableParseError(new Error("PdfTextStrategy insufficient text"))).toBe(true);
    expect(isRetriableParseError(new Error("No strategy can handle this input"))).toBe(true);
  });

  it("treats incomplete agent output as retriable", () => {
    expect(isRetriableAgentError(new Error("Agent output missing required fields"))).toBe(true);
    expect(isRetriableAgentError(new Error("Agent output language not Chinese enough"))).toBe(true);
    expect(isRetriableAgentError(new Error("Agent output quality validation failed"))).toBe(true);
  });
});

describe("runWithProgressRetry", () => {
  it("retries retriable failures and reports progress", async () => {
    let attempts = 0;
    const progress: string[] = [];
    const sleep = vi.fn(async () => {});

    const result = await runWithProgressRetry({
      label: "AI分析",
      attempts: 3,
      baseDelayMs: 50,
      sleep,
      onProgress: async (message) => {
        progress.push(message);
      },
      operation: async () => {
        attempts += 1;
        if (attempts < 3) {
          throw new Error("fetch failed");
        }
        return "ok";
      },
    });

    expect(result).toBe("ok");
    expect(attempts).toBe(3);
    expect(sleep).toHaveBeenCalledTimes(2);
    expect(progress.some((message) => message.includes("重试"))).toBe(true);
  });

  it("does not retry non-retriable failures", async () => {
    let attempts = 0;
    const sleep = vi.fn(async () => {});

    await expect(
      runWithProgressRetry({
        label: "解析文件",
        attempts: 4,
        baseDelayMs: 20,
        sleep,
        operation: async () => {
          attempts += 1;
          throw new Error("invalid file signature");
        },
      })
    ).rejects.toThrow("invalid file signature");

    expect(attempts).toBe(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("emits heartbeat while one attempt is still running", async () => {
    vi.useFakeTimers();

    const progress: string[] = [];
    const task = runWithProgressRetry({
      label: "文件解析",
      attempts: 1,
      heartbeatIntervalMs: 1000,
      onProgress: async (message) => {
        progress.push(message);
      },
      operation: async () => {
        await new Promise((resolve) => setTimeout(resolve, 2600));
        return "ok";
      },
    });

    await vi.advanceTimersByTimeAsync(3000);
    const result = await task;

    expect(result).toBe("ok");
    expect(progress.some((message) => message.includes("已运行"))).toBe(true);

    vi.useRealTimers();
  });
});
