/**
 * Inngest webhook endpoint
 * Handles function invocations from Inngest
 */
import { serve } from 'inngest/next';
import { inngest } from '@/lib/inngest/client';
import { processEntry } from '@/lib/inngest/functions/process-entry';
import { processComparisonBatch } from '@/lib/inngest/functions/process-comparison-batch';

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [processEntry, processComparisonBatch],
});
