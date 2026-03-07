/**
 * Timeline Evolution Component
 * Renders vertical timeline with events, version badges, and significance indicators
 */

interface TimelineEvent {
  marker: string;
  markerVariant?: 'date' | 'stage';
  version?: string;
  title?: string;
  description?: string;
  significance?: 'major' | 'minor' | 'patch';
  details?: Array<{
    label: string;
    value: string;
  }>;
}

interface TimelineEvolutionData {
  events: TimelineEvent[];
  currentStatus?: string;
  futureOutlook?: string;
}

interface TimelineEvolutionProps {
  data: TimelineEvolutionData;
}

const significanceColors = {
  major: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  minor: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
  patch: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
};

const significanceLabels = {
  major: 'Major',
  minor: 'Minor',
  patch: 'Patch',
};

export function TimelineEvolution({ data }: TimelineEvolutionProps) {
  const { events, currentStatus, futureOutlook } = data;

  return (
    <div className="space-y-4">
      {/* Timeline */}
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-border" />

        {/* Events */}
        <div className="space-y-6">
          {events.map((event, idx) => (
            <div key={idx} className="relative pl-10">
              {/* Timeline dot */}
              <div className="absolute left-0 top-1 w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-white" />
              </div>

              {/* Event content */}
              <div className="space-y-1">
                {/* Marker and badges */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={
                      event.markerVariant === 'stage'
                        ? "text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full font-medium"
                        : "text-xs font-medium text-secondary"
                    }
                  >
                    {event.marker}
                  </span>
                  {event.version && (
                    <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full font-mono">
                      {event.version}
                    </span>
                  )}
                  {event.significance && (
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${significanceColors[event.significance]}`}>
                      {significanceLabels[event.significance]}
                    </span>
                  )}
                </div>

                {/* Title */}
                {event.title && (
                  <h5 className="font-medium text-foreground">{event.title}</h5>
                )}

                {/* Description */}
                {event.description && (
                  <p className="text-sm text-secondary">{event.description}</p>
                )}

                {/* Stage-based details */}
                {event.details && event.details.length > 0 && (
                  <dl className="space-y-2 pt-1">
                    {event.details.map((detail) => (
                      <div key={`${event.marker}-${detail.label}`} className="space-y-0.5">
                        <dt className="text-[11px] font-medium uppercase tracking-wide text-secondary">
                          {detail.label}
                        </dt>
                        <dd className="text-sm text-foreground">
                          {detail.value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Current Status */}
      {currentStatus && (
        <div className="px-4 py-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
          <div className="flex items-start gap-2">
            <span className="text-xs px-2 py-1 bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 rounded font-medium shrink-0">
              Current Status
            </span>
            <p className="text-sm text-foreground">{currentStatus}</p>
          </div>
        </div>
      )}

      {/* Future Outlook */}
      {futureOutlook && (
        <div className="px-4 py-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
          <div className="flex items-start gap-2">
            <span className="text-xs px-2 py-1 bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 rounded font-medium shrink-0">
              Future Outlook
            </span>
            <p className="text-sm text-foreground">{futureOutlook}</p>
          </div>
        </div>
      )}
    </div>
  );
}
