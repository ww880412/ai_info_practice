// src/components/comparison/renderers/Section.tsx

interface SectionProps {
  title: string;
  children: React.ReactNode;
}

/**
 * Section component for structured content rendering
 * Used to display titled sections with content
 */
export function Section({ title, children }: SectionProps) {
  return (
    <div className="space-y-2">
      <h5 className="font-medium text-sm text-foreground">{title}</h5>
      <div className="text-sm text-muted-foreground">{children}</div>
    </div>
  );
}
