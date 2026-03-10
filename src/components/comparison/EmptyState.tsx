/**
 * Empty State Component for Mode Comparison
 *
 * Displays a centered message when data is missing or empty.
 */

interface EmptyStateProps {
  message: string;
}

export function EmptyState({ message }: EmptyStateProps) {
  return (
    <div className="flex items-center justify-center py-8 text-muted-foreground">
      <p className="text-sm">{message}</p>
    </div>
  );
}
