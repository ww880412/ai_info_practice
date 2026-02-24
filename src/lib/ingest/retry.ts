export function isRetriableIngestError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /fetch failed|network|timeout|timed out|429|500|502|503|504|econnreset|etimedout|temporarily unavailable/i.test(
    message
  );
}

export function isRetriableParseError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  if (isRetriableIngestError(error)) {
    return true;
  }

  return /insufficient text|no strategy can handle|pdf.*failed/i.test(message);
}

export function isRetriableAgentError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  if (isRetriableIngestError(error)) {
    return true;
  }

  return /missing required fields|invalid final|output incomplete|language not chinese|language rewrite failed|quality validation failed|structure repair failed/i.test(
    message
  );
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface RunWithProgressRetryOptions<T> {
  label: string;
  attempts: number;
  baseDelayMs?: number;
  operation: (attempt: number) => Promise<T>;
  onProgress?: (message: string, attempt: number) => Promise<void> | void;
  heartbeatIntervalMs?: number;
  formatHeartbeat?: (params: {
    label: string;
    attempt: number;
    attempts: number;
    elapsedMs: number;
  }) => string;
  isRetriable?: (error: unknown) => boolean;
  sleep?: (ms: number) => Promise<void>;
}

export async function runWithProgressRetry<T>({
  label,
  attempts,
  baseDelayMs = 2000,
  operation,
  onProgress,
  heartbeatIntervalMs,
  formatHeartbeat,
  isRetriable = isRetriableIngestError,
  sleep = defaultSleep,
}: RunWithProgressRetryOptions<T>): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    await onProgress?.(
      attempt === 1
        ? `${label}进行中...`
        : `${label}重试中（${attempt}/${attempts}）...`,
      attempt
    );

    let heartbeatTimer: NodeJS.Timeout | null = null;
    const startedAt = Date.now();

    if (heartbeatIntervalMs && heartbeatIntervalMs > 0 && onProgress) {
      heartbeatTimer = setInterval(() => {
        const elapsedMs = Date.now() - startedAt;
        const message = formatHeartbeat
          ? formatHeartbeat({ label, attempt, attempts, elapsedMs })
          : `${label}进行中（${attempt}/${attempts}，已运行 ${Math.round(
              elapsedMs / 1000
            )} 秒）...`;
        void onProgress(message, attempt);
      }, heartbeatIntervalMs);
    }

    try {
      const result = await operation(attempt);
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      return result;
    } catch (error) {
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      lastError = error;
      const canRetry = attempt < attempts && isRetriable(error);

      if (!canRetry) {
        throw error;
      }

      const delayMs = baseDelayMs * Math.pow(2, attempt - 1);
      const seconds = Math.max(1, Math.round(delayMs / 1000));
      await onProgress?.(
        `${label}遇到临时问题，${seconds} 秒后重试（${attempt}/${attempts}）...`,
        attempt
      );
      await sleep(delayMs);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}
