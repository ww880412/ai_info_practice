/**
 * Inngest client configuration
 * Persistent task queue for entry processing
 */
import { Inngest, EventSchemas } from 'inngest';

export interface IngestConfig {
  geminiApiKey?: string;
  geminiModel?: string;
}

type Events = {
  'entry/ingest': { data: { entryId: string } };
  'entry/reprocess': { data: { entryId: string } };
  'comparison/process-batch': {
    data: {
      batchId: string;
      entryIds: string[];
      targetMode: 'two-step' | 'tool-calling';
    };
  };
};

export const inngest = new Inngest({
  id: 'ai-practice-hub',
  schemas: new EventSchemas().fromRecord<Events>(),
});
