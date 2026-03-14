import { queryComparisons } from '@/lib/comparison/query-comparisons';
import { ComparisonHistoryList } from '@/components/comparison/ComparisonHistoryList';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ComparisonPage() {
  const result = await queryComparisons({ limit: 20, offset: 0 });

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Mode Comparison History</h1>
        <p className="text-secondary mt-2">
          Review and compare AI analysis results across different modes
        </p>
      </div>

      <ComparisonHistoryList
        initialComparisons={result.comparisons}
        initialTotal={result.total}
      />
    </div>
  );
}
