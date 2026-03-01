import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = {
  apiCredential: {
    findUnique: vi.fn(),
  },
  entry: {
    create: vi.fn(),
    update: vi.fn(),
  },
};

const inngestMock = {
  send: vi.fn(),
};

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

vi.mock("@/lib/inngest/client", () => ({
  inngest: inngestMock,
}));

vi.mock("@/lib/ai/deduplication", () => ({
  findSimilarEntries: vi.fn(async () => []),
}));

describe("POST /api/ingest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("marks entry as FAILED when queue send fails", async () => {
    prismaMock.entry.create.mockResolvedValue({
      id: "entry-1",
    });
    prismaMock.entry.update.mockResolvedValue({});
    inngestMock.send.mockRejectedValue(new Error("missing event key"));

    const { POST } = await import("./route");

    const request = new Request("http://localhost:3001/api/ingest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        inputType: "LINK",
        url: "https://example.com",
      }),
    });

    const response = await POST(request as never);
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload).toEqual({ error: "Failed to ingest content" });
    expect(prismaMock.entry.update).toHaveBeenCalledWith({
      where: { id: "entry-1" },
      data: {
        processStatus: "FAILED",
        processError: expect.stringContaining("missing event key"),
      },
    });
  });
});
