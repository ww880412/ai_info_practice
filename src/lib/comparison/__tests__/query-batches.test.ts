import { describe, it, expect, beforeEach } from 'vitest';
import { queryBatches } from '../query-batches';
import { prisma } from '@/lib/prisma';

describe('queryBatches', () => {
  beforeEach(async () => {
    // Clean up
    await prisma.comparisonBatch.deleteMany();
  });

  it('should return empty array when no batches exist', async () => {
    const result = await queryBatches({ limit: 20, offset: 0 });
    expect(result.batches).toEqual([]);
    expect(result.total).toBe(0);
  });

  it('should return batches sorted by createdAt desc', async () => {
    // Create test batches
    const batch1 = await prisma.comparisonBatch.create({
      data: {
        sourceMode: 'TWO_STEP',
        targetMode: 'TOOL_CALLING',
        entryCount: 5,
        status: 'COMPLETED',
      },
    });

    const batch2 = await prisma.comparisonBatch.create({
      data: {
        sourceMode: 'TOOL_CALLING',
        targetMode: 'TWO_STEP',
        entryCount: 10,
        status: 'PENDING',
      },
    });

    const result = await queryBatches({ limit: 20, offset: 0 });
    expect(result.batches).toHaveLength(2);
    expect(result.batches[0].id).toBe(batch2.id); // Newer first
    expect(result.total).toBe(2);
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

    const result = await queryBatches({
      limit: 20,
      offset: 0,
      status: 'COMPLETED',
    });

    expect(result.batches).toHaveLength(1);
    expect(result.batches[0].status).toBe('COMPLETED');
    expect(result.total).toBe(1);
  });

  it('should respect limit and offset', async () => {
    // Create 5 batches
    for (let i = 0; i < 5; i++) {
      await prisma.comparisonBatch.create({
        data: {
          sourceMode: 'TWO_STEP',
          targetMode: 'TOOL_CALLING',
          entryCount: i,
          status: 'COMPLETED',
        },
      });
    }

    const page1 = await queryBatches({ limit: 2, offset: 0 });
    expect(page1.batches).toHaveLength(2);
    expect(page1.total).toBe(5);

    const page2 = await queryBatches({ limit: 2, offset: 2 });
    expect(page2.batches).toHaveLength(2);
    expect(page2.total).toBe(5);

    // Ensure no overlap
    expect(page1.batches[0].id).not.toBe(page2.batches[0].id);
  });

  it('should use stable sorting with id as tie-breaker', async () => {
    // Create batches with same timestamp by using a fixed date
    const fixedDate = new Date('2024-01-01T00:00:00Z');

    const batch1 = await prisma.comparisonBatch.create({
      data: {
        sourceMode: 'TWO_STEP',
        targetMode: 'TOOL_CALLING',
        entryCount: 1,
        status: 'COMPLETED',
        createdAt: fixedDate,
      },
    });

    const batch2 = await prisma.comparisonBatch.create({
      data: {
        sourceMode: 'TWO_STEP',
        targetMode: 'TOOL_CALLING',
        entryCount: 2,
        status: 'COMPLETED',
        createdAt: fixedDate,
      },
    });

    const batch3 = await prisma.comparisonBatch.create({
      data: {
        sourceMode: 'TWO_STEP',
        targetMode: 'TOOL_CALLING',
        entryCount: 3,
        status: 'COMPLETED',
        createdAt: fixedDate,
      },
    });

    const result = await queryBatches({ limit: 20, offset: 0 });

    // With same createdAt, should sort by id desc (newer IDs first)
    expect(result.batches).toHaveLength(3);
    expect(result.batches[0].id).toBe(batch3.id);
    expect(result.batches[1].id).toBe(batch2.id);
    expect(result.batches[2].id).toBe(batch1.id);
  });
});
