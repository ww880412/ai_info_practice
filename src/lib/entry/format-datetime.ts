export function formatEntryDateTime(value: string | null | undefined): string {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toISOString().slice(0, 16).replace("T", " ") + " UTC";
}
