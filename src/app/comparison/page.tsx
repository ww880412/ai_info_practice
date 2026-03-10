import { queryBatches } from '@/lib/comparison/query-batches';
import { BatchHistoryList } from '@/components/comparison/BatchHistoryList';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ComparisonPage() {
  const result = await queryBatches({ limit: 10, offset: 0 });

  // Serialize dates to ISO strings for client component
  const serializedBatches = result.batches.map((batch) => ({
    ...batch,
    createdAt: batch.createdAt.toISOString(),
  }));

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Mode Comparison History</h1>
        <p className="text-secondary mt-2">
          View and compare Agent processing results across different modes
        </p>
      </div>

      <BatchHistoryList
        initialBatches={serializedBatches}
        initialTotal={result.total}
      />
    </div>
  );
}
