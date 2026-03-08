import { beforeEach, describe, expect, it, vi } from "vitest";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useComparisonBatch } from "../useComparisonBatch";

vi.mock("@tanstack/react-query", () => ({
  useMutation: vi.fn(),
  useQuery: vi.fn(),
  useQueryClient: vi.fn(),
}));

global.fetch = vi.fn();

describe("useComparisonBatch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useMutation).mockReturnValue({
      mutate: vi.fn(),
      isSuccess: false,
      isError: false,
      data: undefined,
    } as any);
    vi.mocked(useQuery).mockReturnValue({
      data: undefined,
      isLoading: false,
    } as any);
    vi.mocked(useQueryClient).mockReturnValue({
      invalidateQueries: vi.fn(),
    } as any);
  });

  describe("createBatch", () => {
    it("creates comparison batch successfully", async () => {
      const mockResponse = {
        data: {
          batchId: "batch-123",
          entryCount: 5,
          estimatedTime: "约 3 分钟",
        },
      };
      let mutationOptions: any;

      vi.mocked(useMutation).mockImplementation((options: any) => {
        mutationOptions = options;
        return {
          mutate: vi.fn(),
          isSuccess: false,
          isError: false,
          data: undefined,
        } as any;
      });

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const hook = useComparisonBatch();
      const payload = {
        entryIds: ["entry1", "entry2", "entry3", "entry4", "entry5"],
        targetMode: "tool-calling" as const,
      };

      const data = await mutationOptions.mutationFn(payload);

      expect(data).toEqual(mockResponse.data);
      expect(fetch).toHaveBeenCalledWith(
        "/api/entries/compare-modes",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      );

      const invalidateQueries = vi.mocked(useQueryClient).mock.results[0].value.invalidateQueries;
      mutationOptions.onSuccess(data);
      expect(invalidateQueries).toHaveBeenCalledWith({
        queryKey: ["comparison-batch", "batch-123"],
      });
      expect(typeof hook.createBatch).toBe("function");
    });

    it("throws error when creation API fails", async () => {
      let mutationOptions: any;
      vi.mocked(useMutation).mockImplementation((options: any) => {
        mutationOptions = options;
        return { mutate: vi.fn() } as any;
      });

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: "Invalid entry IDs" }),
      } as Response);

      useComparisonBatch();

      await expect(
        mutationOptions.mutationFn({
          entryIds: [],
          targetMode: "tool-calling",
        })
      ).rejects.toThrow("Invalid entry IDs");
    });
  });

  describe("getBatchStatus", () => {
    it("fetches batch status successfully", async () => {
      const mockResponse = {
        data: {
          batchId: "batch-123",
          status: "processing",
          progress: 60,
          entryCount: 5,
          completedCount: 3,
        },
      };
      let queryOptions: any;

      vi.mocked(useQuery).mockImplementation((options: any) => {
        queryOptions = options;
        return {
          data: undefined,
          isLoading: false,
        } as any;
      });
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      useComparisonBatch("batch-123");
      const data = await queryOptions.queryFn();

      expect(queryOptions.queryKey).toEqual(["comparison-batch", "batch-123"]);
      expect(queryOptions.enabled).toBe(true);
      expect(data).toEqual(mockResponse.data);
      expect(fetch).toHaveBeenCalledWith("/api/entries/compare-modes/batch-123");
    });

    it("throws error when batch status API fails", async () => {
      let queryOptions: any;
      vi.mocked(useQuery).mockImplementation((options: any) => {
        queryOptions = options;
        return { data: undefined, isLoading: false } as any;
      });
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: "Batch not found" }),
      } as Response);

      useComparisonBatch("batch-404");

      await expect(queryOptions.queryFn()).rejects.toThrow("Batch not found");
    });

    it("does not enable query without batchId", () => {
      let queryOptions: any;
      vi.mocked(useQuery).mockImplementation((options: any) => {
        queryOptions = options;
        return { data: undefined, isLoading: false } as any;
      });

      useComparisonBatch();

      expect(queryOptions.enabled).toBe(false);
    });

    it("returns 2000ms polling interval for processing/pending", () => {
      let queryOptions: any;
      vi.mocked(useQuery).mockImplementation((options: any) => {
        queryOptions = options;
        return { data: undefined, isLoading: false } as any;
      });

      useComparisonBatch("batch-123");

      const processing = queryOptions.refetchInterval({
        state: { data: { status: "processing" } },
      });
      const pending = queryOptions.refetchInterval({
        state: { data: { status: "pending" } },
      });

      expect(processing).toBe(2000);
      expect(pending).toBe(2000);
    });

    it("stops polling for completed/failed batch", () => {
      let queryOptions: any;
      vi.mocked(useQuery).mockImplementation((options: any) => {
        queryOptions = options;
        return { data: undefined, isLoading: false } as any;
      });

      useComparisonBatch("batch-123");

      const completed = queryOptions.refetchInterval({
        state: { data: { status: "completed" } },
      });
      const failed = queryOptions.refetchInterval({
        state: { data: { status: "failed" } },
      });

      expect(completed).toBe(false);
      expect(failed).toBe(false);
    });
  });

  it("exposes status flags from batch query", () => {
    vi.mocked(useQuery).mockReturnValue({
      data: { status: "completed" },
      isLoading: false,
    } as any);

    const hook = useComparisonBatch("batch-123");

    expect(hook.isLoading).toBe(false);
    expect(hook.isProcessing).toBe(false);
    expect(hook.isCompleted).toBe(true);
    expect(hook.isFailed).toBe(false);
  });
});
