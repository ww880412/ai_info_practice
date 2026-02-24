export function parseBulkDeleteIds(payload: unknown): string[] {
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    return [];
  }

  const rawIds = (payload as { ids?: unknown }).ids;
  if (!Array.isArray(rawIds)) {
    return [];
  }

  const normalizedIds = rawIds
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  return Array.from(new Set(normalizedIds));
}
