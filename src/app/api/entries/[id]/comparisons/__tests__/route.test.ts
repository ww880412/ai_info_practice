import { NextRequest } from 'next/server';
import { GET } from '../route';
import { prisma } from '@/lib/prisma';

// Mock Prisma
jest.mock('@/lib/prisma', () => ({
  prisma: {
    entry: {
      findUnique: jest.fn(),
    },
    comparisonBatch: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    modeComparison: {
      findMany: jest.fn(),
    },
  },
}));

describe('GET /api/entries/[id]/comparisons', () => {
  const mockEntryId = 'entry-123';
  const mockBatchId1 = 'batch-1';
  const mockBatchId2 = 'batch-2';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const createMockRequest = (queryParams: Record<string, string> = {}) => {
    const url = new URL(`http://localhost/api/entries/${mockEntryId}/comparisons`);
    Object.entries(queryParams).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
    return new NextRequest(url);
  };

  it('should return 404 if entry does not exist', async () => {
    (prisma.entry.findUnique as jest.Mock).mockResolvedValue(null);

    const request = createMockRequest();
    const response = await GET(request, { params: Promise.resolve({ id: mockEntryId }) });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data).toEqual({ error: 'Entry not found' });
  });

  it('should return empty list for entry with no comparisons', async () => {
    (prisma.entry.findUnique as jest.Mock).mockResolvedValue({
      id: mockEntryId,
      originalExecutionMode: 'two-step',
    });
    (prisma.comparisonBatch.count as jest.Mock).mockResolvedValue(0);
    (prisma.comparisonBatch.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.modeComparison.findMany as jest.Mock).mockResolvedValue([]);

    const request = createMockRequest();
    const response = await GET(request, { params: Promise.resolve({ id: mockEntryId }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.comparisons).toEqual([]);
    expect(data.data.pageInfo).toEqual({
      total: 0,
      limit: 20,
      offset: 0,
      hasNext: false,
      nextOffset: null,
    });
  });

  it('should return comparison list with completed results', async () => {
    const mockBatch = {
      id: mockBatchId1,
      createdAt: new Date('2026-03-10T10:00:00Z'),
      status: 'COMPLETED',
      sourceMode: 'TWO_STEP',
      targetMode: 'TOOL_CALLING',
    };

    const mockComparison = {
      id: 'comparison-1',
      batchId: mockBatchId1,
      createdAt: new Date('2026-03-10T10:05:00Z'),
      originalMode: 'two-step',
      comparisonMode: 'tool-calling',
      originalScore: { overallScore: 85 },
      comparisonScore: { overallScore: 90 },
      winner: 'comparison',
      scoreDiff: 5,
    };

    (prisma.entry.findUnique as jest.Mock).mockResolvedValue({
      id: mockEntryId,
      originalExecutionMode: 'two-step',
    });
    (prisma.comparisonBatch.count as jest.Mock).mockResolvedValue(1);
    (prisma.comparisonBatch.findMany as jest.Mock).mockResolvedValue([mockBatch]);
    (prisma.modeComparison.findMany as jest.Mock).mockResolvedValue([mockComparison]);

    const request = createMockRequest();
    const response = await GET(request, { params: Promise.resolve({ id: mockEntryId }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.comparisons).toHaveLength(1);
    expect(data.data.comparisons[0]).toMatchObject({
      batchId: mockBatchId1,
      batchStatus: 'COMPLETED',
      originalMode: 'two-step',
      comparisonMode: 'tool-calling',
      resultId: 'comparison-1',
      winner: 'comparison',
      originalOverallScore: 85,
      comparisonOverallScore: 90,
      scoreDiff: 5,
    });
  });

  it('should return in-progress batch with nullable scores', async () => {
    const mockBatch = {
      id: mockBatchId1,
      createdAt: new Date('2026-03-10T10:00:00Z'),
      status: 'PROCESSING',
      sourceMode: 'TWO_STEP',
      targetMode: 'TOOL_CALLING',
    };

    (prisma.entry.findUnique as jest.Mock).mockResolvedValue({
      id: mockEntryId,
      originalExecutionMode: 'two-step',
    });
    (prisma.comparisonBatch.count as jest.Mock).mockResolvedValue(1);
    (prisma.comparisonBatch.findMany as jest.Mock).mockResolvedValue([mockBatch]);
    (prisma.modeComparison.findMany as jest.Mock).mockResolvedValue([]);

    const request = createMockRequest();
    const response = await GET(request, { params: Promise.resolve({ id: mockEntryId }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.comparisons).toHaveLength(1);
    expect(data.data.comparisons[0]).toMatchObject({
      batchId: mockBatchId1,
      batchStatus: 'PROCESSING',
      originalMode: 'two-step',
      comparisonMode: undefined,
      resultId: undefined,
      processedAt: undefined,
      winner: undefined,
      originalOverallScore: undefined,
      comparisonOverallScore: undefined,
      scoreDiff: undefined,
    });
  });

  it('should filter by status', async () => {
    (prisma.entry.findUnique as jest.Mock).mockResolvedValue({
      id: mockEntryId,
      originalExecutionMode: 'two-step',
    });
    (prisma.comparisonBatch.count as jest.Mock).mockResolvedValue(1);
    (prisma.comparisonBatch.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.modeComparison.findMany as jest.Mock).mockResolvedValue([]);

    const request = createMockRequest({ status: 'COMPLETED' });
    await GET(request, { params: Promise.resolve({ id: mockEntryId }) });

    expect(prisma.comparisonBatch.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        status: 'COMPLETED',
      }),
    });
  });

  it('should filter by date range', async () => {
    (prisma.entry.findUnique as jest.Mock).mockResolvedValue({
      id: mockEntryId,
      originalExecutionMode: 'two-step',
    });
    (prisma.comparisonBatch.count as jest.Mock).mockResolvedValue(0);
    (prisma.comparisonBatch.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.modeComparison.findMany as jest.Mock).mockResolvedValue([]);

    const from = '2026-03-01T00:00:00Z';
    const to = '2026-03-10T23:59:59Z';
    const request = createMockRequest({ from, to });
    await GET(request, { params: Promise.resolve({ id: mockEntryId }) });

    expect(prisma.comparisonBatch.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        createdAt: {
          gte: new Date(from),
          lte: new Date(to),
        },
      }),
    });
  });

  it('should apply pagination correctly', async () => {
    (prisma.entry.findUnique as jest.Mock).mockResolvedValue({
      id: mockEntryId,
      originalExecutionMode: 'two-step',
    });
    (prisma.comparisonBatch.count as jest.Mock).mockResolvedValue(50);
    (prisma.comparisonBatch.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.modeComparison.findMany as jest.Mock).mockResolvedValue([]);

    const request = createMockRequest({ limit: '10', offset: '20' });
    const response = await GET(request, { params: Promise.resolve({ id: mockEntryId }) });
    const data = await response.json();

    expect(prisma.comparisonBatch.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 20,
        take: 10,
      })
    );

    expect(data.data.pageInfo).toEqual({
      total: 50,
      limit: 10,
      offset: 20,
      hasNext: true,
      nextOffset: 30,
    });
  });

  it('should enforce max limit of 100', async () => {
    (prisma.entry.findUnique as jest.Mock).mockResolvedValue({
      id: mockEntryId,
      originalExecutionMode: 'two-step',
    });
    (prisma.comparisonBatch.count as jest.Mock).mockResolvedValue(200);
    (prisma.comparisonBatch.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.modeComparison.findMany as jest.Mock).mockResolvedValue([]);

    const request = createMockRequest({ limit: '150' });
    const response = await GET(request, { params: Promise.resolve({ id: mockEntryId }) });

    expect(response.status).toBe(400);
  });

  it('should sort by createdAt desc by default', async () => {
    (prisma.entry.findUnique as jest.Mock).mockResolvedValue({
      id: mockEntryId,
      originalExecutionMode: 'two-step',
    });
    (prisma.comparisonBatch.count as jest.Mock).mockResolvedValue(0);
    (prisma.comparisonBatch.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.modeComparison.findMany as jest.Mock).mockResolvedValue([]);

    const request = createMockRequest();
    await GET(request, { params: Promise.resolve({ id: mockEntryId }) });

    expect(prisma.comparisonBatch.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { createdAt: 'desc' },
      })
    );
  });

  it('should handle invalid query parameters', async () => {
    (prisma.entry.findUnique as jest.Mock).mockResolvedValue({
      id: mockEntryId,
      originalExecutionMode: 'two-step',
    });

    const request = createMockRequest({ status: 'INVALID_STATUS' });
    const response = await GET(request, { params: Promise.resolve({ id: mockEntryId }) });

    expect(response.status).toBe(400);
  });

  it('should handle database errors gracefully', async () => {
    (prisma.entry.findUnique as jest.Mock).mockRejectedValue(new Error('Database error'));

    const request = createMockRequest();
    const response = await GET(request, { params: Promise.resolve({ id: mockEntryId }) });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toEqual({ error: 'Failed to get entry comparisons' });
  });
});
