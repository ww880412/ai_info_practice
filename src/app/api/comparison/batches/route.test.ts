import { describe, it, expect, beforeEach } from 'vitest';
import { GET } from './route';
import { prisma } from '@/lib/prisma';

describe('GET /api/comparison/batches', () => {
  beforeEach(async () => {
    await prisma.comparisonBatch.deleteMany();
  });

  it('should return empty array when no batches exist', async () => {
    const request = new Request('http://localhost:3000/api/comparison/batches');
    const response = await GET(request as any);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.batches).toEqual([]);
    expect(data.data.pageInfo.total).toBe(0);
  });

  it('should return batches with pagination info', async () => {
    // Create test batch
    await prisma.comparisonBatch.create({
      data: {
        sourceMode: 'TWO_STEP',
        targetMode: 'TOOL_CALLING',
        entryCount: 5,
        status: 'COMPLETED',
      },
    });

    const request = new Request('http://localhost:3000/api/comparison/batches');
    const response = await GET(request as any);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.batches).toHaveLength(1);
    expect(data.data.pageInfo).toMatchObject({
      total: 1,
      limit: 20,
      offset: 0,
      hasNext: false,
      nextOffset: null,
    });
  });

  it('should validate limit parameter', async () => {
    const request = new Request(
      'http://localhost:3000/api/comparison/batches?limit=200'
    );
    const response = await GET(request as any);
    const data = await response.json();

    expect(data.data.pageInfo.limit).toBe(100); // Clamped to MAX_LIMIT
  });

  it('should return 400 for invalid status', async () => {
    const request = new Request(
      'http://localhost:3000/api/comparison/batches?status=INVALID'
    );
    const response = await GET(request as any);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error.code).toBe('INVALID_PARAMS');
  });

  it('should handle NaN limit gracefully', async () => {
    const request = new Request(
      'http://localhost:3000/api/comparison/batches?limit=abc'
    );
    const response = await GET(request as any);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.pageInfo.limit).toBe(20); // Falls back to default
  });

  it('should handle negative offset gracefully', async () => {
    const request = new Request(
      'http://localhost:3000/api/comparison/batches?offset=-10'
    );
    const response = await GET(request as any);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.pageInfo.offset).toBe(0); // Falls back to 0
  });

  it('should filter by status', async () => {
    await prisma.comparisonBatch.create({
      data: {
        sourceMode: 'TWO_STEP',
        targetMode: 'TOOL_CALLING',
        entryCount: 5,
        status: 'COMPLETED',
      },
    });

    await prisma.comparisonBatch.create({
      data: {
        sourceMode: 'TWO_STEP',
        targetMode: 'TOOL_CALLING',
        entryCount: 10,
        status: 'PENDING',
      },
    });

    const request = new Request(
      'http://localhost:3000/api/comparison/batches?status=COMPLETED'
    );
    const response = await GET(request as any);
    const data = await response.json();

    expect(data.data.batches).toHaveLength(1);
    expect(data.data.batches[0].status).toBe('COMPLETED');
  });
});
