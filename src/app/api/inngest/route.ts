/**
 * Inngest webhook endpoint
 * Handles function invocations from Inngest
 */
import { serve } from 'inngest/next';
import { inngest } from '@/lib/inngest/client';
import { processEntry } from '@/lib/inngest/functions/process-entry';

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [processEntry],
});
