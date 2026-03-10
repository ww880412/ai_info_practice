// src/components/comparison/dimensions/StructureCard.tsx

'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { NormalizedDecision } from '@/lib/comparison/normalize';
import { StructureRenderer } from '../renderers/StructureRenderer';

interface StructureCardProps {
  normalizedOriginal: NormalizedDecision;
  normalizedComparison: NormalizedDecision;
  originalMode: string;
  comparisonMode: string;
}

/**
 * Structure Card - Dimension 4 container
 *
 * Displays structured content side-by-side
 * Calls StructureRenderer for dynamic rendering
 */
export function StructureCard({
  normalizedOriginal,
  normalizedComparison,
  originalMode,
  comparisonMode,
}: StructureCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>结构化内容</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <h4 className="font-medium text-sm mb-3">
              Original ({originalMode})
            </h4>
            <StructureRenderer decision={normalizedOriginal} />
          </div>
          <div>
            <h4 className="font-medium text-sm mb-3">
              Comparison ({comparisonMode})
            </h4>
            <StructureRenderer decision={normalizedComparison} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
