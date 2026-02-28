import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { parseWithJina } from "./jina";

describe("parseWithJina", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns parsed content on success", async () => {
    const mockMarkdown = `# Test Title

This is the article content with more than 100 characters to pass validation.
Lorem ipsum dolor sit amet, consectetur adipiscing elit.`;

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      text: async () => mockMarkdown,
    } as Response);

    const result = await parseWithJina("https://example.com/article");

    expect(result.success).toBe(true);
    expect(result.title).toBe("Test Title");
    expect(result.content).toContain("This is the article content");
  });

  it("returns failure on HTTP error", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: "Not Found",
    } as Response);

    const result = await parseWithJina("https://example.com/missing");

    expect(result.success).toBe(false);
    expect(result.error).toContain("404");
  });

  it("returns failure on empty content", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      text: async () => "short",
    } as Response);

    const result = await parseWithJina("https://example.com/empty");

    expect(result.success).toBe(false);
    expect(result.error).toContain("too short");
  });

  it("extracts title from URL when no heading found", async () => {
    const mockMarkdown = `No heading here, just content that is long enough to pass the validation check for minimum content length.`;

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      text: async () => mockMarkdown,
    } as Response);

    const result = await parseWithJina("https://example.com/my-article-title");

    expect(result.success).toBe(true);
    expect(result.title).toBe("my article title");
  });

  it("handles network errors gracefully", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error("Network error"));

    const result = await parseWithJina("https://example.com");

    expect(result.success).toBe(false);
    expect(result.error).toBe("Network error");
  });
});
