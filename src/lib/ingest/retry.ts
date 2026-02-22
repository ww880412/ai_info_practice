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

  return /missing required fields|invalid final|output incomplete/i.test(message);
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
  isRetriable?: (error: unknown) => boolean;
  sleep?: (ms: number) => Promise<void>;
}

export async function runWithProgressRetry<T>({
  label,
  attempts,
  baseDelayMs = 2000,
  operation,
  onProgress,
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

    try {
      return await operation(attempt);
    } catch (error) {
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
