export interface GlobalComparisonItem {
  id: string;
  createdAt: string;
  batchId: string;
  originalMode: string;
  comparisonMode: string;
  winner: string | null;
  scoreDiff: number;
  originalOverallScore: number | null;
  comparisonOverallScore: number | null;
  entryId: string;
  entryTitle: string | null;
  batchStatus: string;
}
