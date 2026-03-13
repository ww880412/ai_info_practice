/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { BatchHistoryList, type SerializedBatch } from './BatchHistoryList';

// Mock fetch
global.fetch = vi.fn();

describe('BatchHistoryList', () => {
  const mockBatches: SerializedBatch[] = [
    {
      id: 'batch1',
      createdAt: '2026-03-10T10:00:00.000Z',
      sourceMode: 'two-step',
      targetMode: 'tool-calling',
      entryCount: 10,
      status: 'COMPLETED',
      progress: 100,
      processedCount: 10,
      winRate: 0.7,
      avgScoreDiff: 5.2,
      stats: {},
    },
    {
      id: 'batch2',
      createdAt: '2026-03-09T10:00:00.000Z',
      sourceMode: 'tool-calling',
      targetMode: 'two-step',
      entryCount: 5,
      status: 'PROCESSING',
      progress: 60,
      processedCount: 3,
      winRate: null,
      avgScoreDiff: null,
      stats: {},
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('should render empty state when no batches', () => {
    render(<BatchHistoryList initialBatches={[]} initialTotal={0} />);

    expect(screen.getByText('No comparison batches yet')).toBeInTheDocument();
    expect(
      screen.getByText('Start a comparison from the Library page')
    ).toBeInTheDocument();
  });

  it('should render batch cards', () => {
    render(<BatchHistoryList initialBatches={mockBatches} initialTotal={2} />);

    expect(screen.getByText('two-step vs tool-calling')).toBeInTheDocument();
    expect(screen.getByText('tool-calling vs two-step')).toBeInTheDocument();
  });

  it('should show Load More button when hasMore is true', () => {
    render(<BatchHistoryList initialBatches={mockBatches} initialTotal={20} />);

    expect(screen.getByText('Load More')).toBeInTheDocument();
    expect(screen.getByText('Showing 2 of 20 batches')).toBeInTheDocument();
  });

  it('should not show Load More button when all batches loaded', () => {
    render(<BatchHistoryList initialBatches={mockBatches} initialTotal={2} />);

    expect(screen.queryByText('Load More')).not.toBeInTheDocument();
  });

  it('should load more batches on button click', async () => {
    const moreBatches: SerializedBatch[] = [
      {
        id: 'batch3',
        createdAt: '2026-03-08T10:00:00.000Z',
        sourceMode: 'two-step',
        targetMode: 'tool-calling',
        entryCount: 8,
        status: 'COMPLETED',
        progress: 100,
        processedCount: 8,
        winRate: 0.5,
        avgScoreDiff: 2.1,
        stats: {},
      },
    ];

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          batches: moreBatches,
          total: 3,
        },
      }),
    } as Response);

    render(<BatchHistoryList initialBatches={mockBatches} initialTotal={3} />);

    const loadMoreButton = screen.getByRole('button', { name: /load more/i });
    fireEvent.click(loadMoreButton);

    // Fast-forward through all timers
    await vi.runAllTimersAsync();

    // After loading all batches (3 of 3), hasMore is false so Load More section is hidden
    expect(screen.queryByText('Load More')).not.toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith(
      '/api/comparison/batches?limit=10&offset=2'
    );
  });

  it('should show loading state while fetching', async () => {
    // Use a fetch that won't resolve until we let it, to observe loading state
    let resolveFetch!: (value: Response) => void;
    vi.mocked(fetch).mockImplementationOnce(
      () => new Promise<Response>((resolve) => { resolveFetch = resolve; })
    );

    render(<BatchHistoryList initialBatches={mockBatches} initialTotal={5} />);

    const loadMoreButton = screen.getByRole('button', { name: /load more/i });
    fireEvent.click(loadMoreButton);

    // Fast-forward through the backoff delay so fetch() gets called
    await vi.advanceTimersByTimeAsync(1000);

    // Now the component is waiting for fetch - should show loading state
    expect(screen.getByText('Loading...')).toBeInTheDocument();
    expect(loadMoreButton).toBeDisabled();

    // Resolve the fetch
    await act(async () => {
      resolveFetch({
        ok: true,
        json: async () => ({ data: { batches: [], total: 5 } }),
      } as Response);
    });

    expect(screen.getByRole('button', { name: /load more/i })).not.toBeDisabled();
  });

  it('should show error message on fetch failure', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      statusText: 'Internal Server Error',
    } as Response);

    render(<BatchHistoryList initialBatches={mockBatches} initialTotal={3} />);

    const loadMoreButton = screen.getByRole('button', { name: /load more/i });
    fireEvent.click(loadMoreButton);

    // Fast-forward through all timers
    await vi.runAllTimersAsync();

    expect(
      screen.getByText(/Failed to load more batches/)
    ).toBeInTheDocument();
  });

  it('should implement exponential backoff on retry', async () => {
    // First attempt fails
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      statusText: 'Server Error',
    } as Response);

    render(<BatchHistoryList initialBatches={mockBatches} initialTotal={3} />);

    const loadMoreButton = screen.getByRole('button', { name: /load more/i });

    await act(async () => {
      fireEvent.click(loadMoreButton);
      await vi.runAllTimersAsync();
    });

    expect(screen.getByText(/Retry 1/)).toBeInTheDocument();

    // Second attempt fails
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      statusText: 'Server Error',
    } as Response);

    await act(async () => {
      fireEvent.click(loadMoreButton);
      await vi.runAllTimersAsync();
    });

    expect(screen.getByText(/Retry 2/)).toBeInTheDocument();
  });

  it('should reset retry count on successful load', async () => {
    // First attempt fails
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      statusText: 'Server Error',
    } as Response);

    render(<BatchHistoryList initialBatches={mockBatches} initialTotal={4} />);

    const loadMoreButton = screen.getByRole('button', { name: /load more/i });
    fireEvent.click(loadMoreButton);

    // Fast-forward through first delay
    await vi.runAllTimersAsync();

    expect(screen.getByText(/Retry 1/)).toBeInTheDocument();

    // Second attempt succeeds
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          batches: [
            {
              id: 'batch3',
              createdAt: '2026-03-08T10:00:00.000Z',
              sourceMode: 'two-step',
              targetMode: 'tool-calling',
              entryCount: 8,
              status: 'COMPLETED',
              progress: 100,
              processedCount: 8,
              winRate: 0.5,
              avgScoreDiff: 2.1,
              stats: {},
            },
          ],
          total: 3,
        },
      }),
    } as Response);

    fireEvent.click(loadMoreButton);

    // Fast-forward through second delay
    await vi.runAllTimersAsync();

    expect(screen.queryByText(/Retry/)).not.toBeInTheDocument();
  });

  it('should handle API error response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        error: 'Database connection failed',
      }),
    } as Response);

    render(<BatchHistoryList initialBatches={mockBatches} initialTotal={3} />);

    const loadMoreButton = screen.getByRole('button', { name: /load more/i });
    fireEvent.click(loadMoreButton);

    // Fast-forward through all timers
    await vi.runAllTimersAsync();

    expect(
      screen.getByText(/Database connection failed/)
    ).toBeInTheDocument();
  });
});
