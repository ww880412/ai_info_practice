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
  'entry/ingest': { data: { entryId: string; config?: IngestConfig } };
  'entry/reprocess': { data: { entryId: string; config?: IngestConfig } };
};

export const inngest = new Inngest({
  id: 'ai-practice-hub',
  schemas: new EventSchemas().fromRecord<Events>(),
});
